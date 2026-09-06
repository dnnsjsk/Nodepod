import type { MemoryVolume } from "../memory-volume";

export interface VFSChange {
  path: string;
  content: ArrayBuffer | null;
  isDirectory: boolean;
  symlinkTarget?: string;
}

/** Preserve links, including dangling ones, instead of copying their targets. */
export function readVFSChange(volume: MemoryVolume, filename: string): VFSChange {
  const path = filename.startsWith("/") ? filename : "/" + filename;
  let stat;
  try { stat = volume.lstatSync(path); }
  catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
    return { path, content: null, isDirectory: false };
  }
  if (stat.isSymbolicLink()) {
    return { path, content: new ArrayBuffer(0), isDirectory: false, symlinkTarget: volume.readlinkSync(path) };
  }
  if (stat.isDirectory()) return { path, content: new ArrayBuffer(0), isDirectory: true };
  const bytes = volume.readFileSync(path);
  // WASI writes may be backed by SAB, which is not transferable.
  const content = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(content).set(bytes);
  return { path, content, isDirectory: false };
}

export function applyVFSChange(volume: MemoryVolume, change: VFSChange): void {
  if (change.content === null) {
    try { volume.removeTreeSync(change.path); }
    catch (error) { if ((error as { code?: string }).code !== "ENOENT") throw error; }
    return;
  }
  if (change.symlinkTarget !== undefined) {
    // Snapshot mounting replaces the link itself, never follows it for deletion.
    volume.mountBinarySnapshot({ data: new ArrayBuffer(0), manifest: [{
      path: change.path, offset: 0, length: 0, isDirectory: false,
      symlinkTarget: change.symlinkTarget,
    }] }, false);
    return;
  }
  if (change.isDirectory) {
    if (!volume.existsSync(change.path)) volume.mkdirSync(change.path, { recursive: true });
    return;
  }
  const parent = change.path.substring(0, change.path.lastIndexOf("/")) || "/";
  if (!volume.existsSync(parent)) volume.mkdirSync(parent, { recursive: true });
  volume.writeFileSync(change.path, new Uint8Array(change.content));
}
