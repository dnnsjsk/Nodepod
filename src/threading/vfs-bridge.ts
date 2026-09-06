// syncs the canonical MemoryVolume with worker VFS clones
// creates snapshots for init, applies worker writes, broadcasts changes

import type { MemoryVolume } from "../memory-volume";
import { isInternalVfsPath } from "../constants/internal-vfs-paths";
import type { VFSBinarySnapshot, VFSSnapshotEntry } from "./worker-protocol";
import type { SharedVFSController } from "./shared-vfs";
import { applyVFSChange, readVFSChange } from "./vfs-change";

const VFS_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB

export class VFSBridge {
  private _volume: MemoryVolume;
  private _broadcaster: ((path: string, content: ArrayBuffer | null, isDirectory: boolean, excludePid: number, symlinkTarget?: string) => void) | null = null;
  private _sharedVFS: SharedVFSController | null = null;
  // suppressed during handleWorkerWrite/Mkdir/Delete to prevent double-broadcasting
  private _suppressWatch = false;
  private _warnedSharedVFSDrop = false;

  constructor(volume: MemoryVolume) {
    this._volume = volume;
  }

  setBroadcaster(fn: (path: string, content: ArrayBuffer | null, isDirectory: boolean, excludePid: number, symlinkTarget?: string) => void): void {
    this._broadcaster = fn;
  }

  setSharedVFS(controller: SharedVFSController, hydrate = false): void {
    this._sharedVFS = controller;
    if (hydrate) this._hydrateSharedVFS();
  }

  clearSharedVFS(): void {
    this._sharedVFS = null;
  }

  private _hydrateSharedVFS(): void {
    this._walkVolume("/", (path, isDirectory, content) => {
      if (isDirectory) this._sharedVFSWriteDirectory(path);
      else if (content) this._sharedVFSWrite(path, content);
    });
  }

  // packs all files into one ArrayBuffer plus a manifest.
  // excludeDirNames (lean spawn mode): directories with these names are
  // recorded as empty dir entries but not descended into — the worker
  // hydrates their contents lazily via the fs proxy.
  createSnapshot(opts?: { excludeDirNames?: string[] }): VFSBinarySnapshot {
    const manifest: VFSSnapshotEntry[] = [];
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    const exclude =
      opts?.excludeDirNames && opts.excludeDirNames.length > 0
        ? new Set(opts.excludeDirNames)
        : null;

    this._walkVolume("/", (path, isDirectory, content, metadata) => {
      if (isDirectory) {
        manifest.push({
          path,
          offset: 0,
          length: 0,
          isDirectory: true,
          ...metadata,
        });
      } else if (content || metadata?.symlinkTarget !== undefined) {
        manifest.push({
          path,
          offset: totalSize,
          length: content?.byteLength ?? 0,
          isDirectory: false,
          ...metadata,
        });
        if (content) {
          chunks.push(content);
          totalSize += content.byteLength;
        }
      }
    }, exclude);

    const data = new ArrayBuffer(totalSize);
    const view = new Uint8Array(data);
    let offset = 0;
    for (const chunk of chunks) {
      view.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const snapshot: VFSBinarySnapshot = { manifest, data };
    if (exclude) snapshot.lazyDirNames = opts!.excludeDirNames!.slice();
    return snapshot;
  }

  // split into chunks for large transfers
  createChunkedSnapshots(): { chunkIndex: number; totalChunks: number; data: ArrayBuffer; manifest: VFSSnapshotEntry[] }[] {
    const fullSnapshot = this.createSnapshot();
    const totalSize = fullSnapshot.data.byteLength;

    if (totalSize <= VFS_CHUNK_SIZE) {
      return [{
        chunkIndex: 0,
        totalChunks: 1,
        data: fullSnapshot.data,
        manifest: fullSnapshot.manifest,
      }];
    }

    const pending: Array<{ data: ArrayBuffer; manifest: VFSSnapshotEntry[] }> = [];
    const fullData = new Uint8Array(fullSnapshot.data);

    const metadata = fullSnapshot.manifest.filter(entry => entry.isDirectory || entry.symlinkTarget !== undefined);
    let entries: VFSSnapshotEntry[] = [...metadata];
    let dataParts: Uint8Array[] = [];
    let chunkBytes = 0;

    const flush = (): void => {
      if (entries.length === 0) return;
      const data = new ArrayBuffer(chunkBytes);
      const view = new Uint8Array(data);
      let offset = 0;
      for (const part of dataParts) {
        view.set(part, offset);
        offset += part.byteLength;
      }
      pending.push({ data, manifest: entries });
      entries = [];
      dataParts = [];
      chunkBytes = 0;
    };

    for (const entry of fullSnapshot.manifest) {
      if (entry.isDirectory || entry.symlinkTarget !== undefined) continue;
      if (chunkBytes > 0 && chunkBytes + entry.length > VFS_CHUNK_SIZE) flush();
      const content = fullData.subarray(entry.offset, entry.offset + entry.length);
      entries.push({ ...entry, offset: chunkBytes });
      dataParts.push(content);
      chunkBytes += content.byteLength;

    }

    flush();
    return pending.map((chunk, chunkIndex) => ({
      ...chunk,
      chunkIndex,
      totalChunks: pending.length,
    }));
  }

  handleWorkerWrite(path: string, content: Uint8Array): void {
    this._suppressWatch = true;
    try {
      const parentDir = path.substring(0, path.lastIndexOf("/")) || "/";
      if (parentDir !== "/" && !this._volume.existsSync(parentDir)) {
        this._volume.mkdirSync(parentDir, { recursive: true });
      }
      if (isInternalVfsPath(path)) {
        this._volume.writeCacheSync(path, content);
      } else {
        this._volume.writeFileSync(path, content);
      }
      if (this._sharedVFS) {
        this._sharedVFSWrite(path, content);
      }
    } finally {
      this._suppressWatch = false;
    }
  }

  handleWorkerSnapshot(snapshot: VFSBinarySnapshot): void {
    this._suppressWatch = true;
    try {
      this._volume.mountBinarySnapshot(snapshot, false);
      if (this._sharedVFS) this._hydrateSharedVFS();
    } finally {
      this._suppressWatch = false;
    }
  }

  handleWorkerSymlink(path: string, symlinkTarget: string): void {
    this._suppressWatch = true;
    try {
      applyVFSChange(this._volume, { path, symlinkTarget, content: new ArrayBuffer(0), isDirectory: false });
      // The SAB byte cache cannot represent links. Canonical/lazy reads retain them.
      this._sharedVFS?.deleteFile(path);
    } finally { this._suppressWatch = false; }
  }

  // writeFile returns false on table/data exhaustion — silent drops mean
  // workers stop seeing updates, so surface it once per session
  private _sharedVFSWrite(path: string, content: Uint8Array): void {
    if (!this._sharedVFS!.writeFile(path, content)) {
      this._warnSharedVFSDrop(path);
    }
  }

  private _sharedVFSWriteDirectory(path: string): void {
    if (!this._sharedVFS!.writeDirectory(path)) {
      this._warnSharedVFSDrop(path);
    }
  }

  private _warnSharedVFSDrop(path: string): void {
    if (!this._warnedSharedVFSDrop) {
      this._warnedSharedVFSDrop = true;
      const stats = this._sharedVFS!.getStats();
      console.warn(
        `[VFSBridge] SharedVFS write dropped for "${path}" (entries: ${stats.entries}, data: ${stats.dataUsed}/${stats.bufferSize} bytes). ` +
          `Workers may see stale reads. Further drops counted in getStats().droppedWrites.`,
      );
    }
  }

  handleWorkerMkdir(path: string): void {
    this._suppressWatch = true;
    try {
      if (!this._volume.existsSync(path)) {
        this._volume.mkdirSync(path, { recursive: true });
      }
      if (this._sharedVFS) {
        this._sharedVFSWriteDirectory(path);
      }
    } finally {
      this._suppressWatch = false;
    }
  }

  handleWorkerDelete(path: string): void {
    this._suppressWatch = true;
    try {
      try {
        applyVFSChange(this._volume, { path, content: null, isDirectory: false });
      } catch (e) {
        console.warn(`[VFSBridge] Failed to delete "${path}":`, e);
      }
      if (this._sharedVFS) {
        this._sharedVFS.deleteFile(path);
      }
    } finally {
      this._suppressWatch = false;
    }
  }

  broadcastChange(path: string, content: ArrayBuffer | null, isDirectory: boolean, excludePid: number, symlinkTarget?: string): void {
    if (isInternalVfsPath(path)) return;
    if (this._broadcaster) {
      this._broadcaster(path, content, isDirectory, excludePid, symlinkTarget);
    }
  }

  // watch the canonical volume and push changes to workers, returns unsubscribe fn
  watch(): () => void {
    const handle = this._volume.watch("/", { recursive: true }, (event, filename) => {
      if (!filename || this._suppressWatch) return;

      // watch callbacks get filenames relative to the watch root, so
      // writing /hello.txt while watching / comes through as "hello.txt".
      // SharedVFS and broadcast keys are absolute, promote it here.
      const absPath = filename.startsWith("/") ? filename : "/" + filename;
      if (isInternalVfsPath(absPath)) return;

      try {
        const change = readVFSChange(this._volume, absPath);
        this.broadcastChange(change.path, change.content, change.isDirectory, -1, change.symlinkTarget);
        if (this._sharedVFS) {
          if (change.content === null || change.symlinkTarget !== undefined) this._sharedVFS.deleteFile(absPath);
          else if (change.isDirectory) this._sharedVFSWriteDirectory(absPath);
          else this._sharedVFSWrite(absPath, new Uint8Array(change.content));
        }
      } catch (e) {
        console.warn(`[VFSBridge] Watch error for "${absPath}":`, e);
      }
    });

    return () => handle.close();
  }

  private _walkVolume(
    dir: string,
    visitor: (path: string, isDirectory: boolean, content: Uint8Array | null, metadata?: Partial<VFSSnapshotEntry>) => void,
    excludeDirNames?: Set<string> | null,
    linksOnly = false,
  ): void {
    try {
      const entries = this._volume.readdirSync(dir);
      for (const name of entries) {
        const fullPath = dir === "/" ? `/${name}` : `${dir}/${name}`;
        if (isInternalVfsPath(fullPath)) continue;
        try {
          const lstat = this._volume.lstatSync(fullPath);
          if (lstat.isSymbolicLink()) {
            visitor(fullPath, false, null, { symlinkTarget: this._volume.readlinkSync(fullPath) });
            continue;
          }
          const stat = lstat;
          const metadata = {
            inode: stat.ino,
            mode: stat.mode,
            atimeMs: stat.atimeMs,
            mtimeMs: stat.mtimeMs,
            ctimeMs: stat.ctimeMs,
            nlink: stat.nlink,
          };
          if (stat.isDirectory()) {
            if (!linksOnly) visitor(fullPath, true, null, metadata);
            // Lazy snapshots omit package bytes, not link identity. Following a
            // link must resolve to the workspace and its shared dependency tree.
            this._walkVolume(fullPath, visitor, excludeDirNames, linksOnly || !!excludeDirNames?.has(name));
          } else if (!linksOnly) {
            const content = this._volume.readFileSync(fullPath);
            visitor(fullPath, false, content, metadata);
          }
        } catch (e) {
          console.warn(`[VFSBridge] Failed to stat/read "${fullPath}":`, e);
        }
      }
    } catch (e) {
      console.warn(`[VFSBridge] Failed to read directory "${dir}":`, e);
    }
  }
}
