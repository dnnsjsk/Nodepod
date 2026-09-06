import { describe, expect, it } from "vitest";
import { MemoryVolume } from "../memory-volume";
import { applyVFSChange, readVFSChange } from "../threading/vfs-change";
import { VFSBridge } from "../threading/vfs-bridge";

function fixture() {
  const volume = new MemoryVolume();
  volume.mkdirSync("/app/packages/ui", { recursive: true });
  volume.mkdirSync("/app/node_modules/@example", { recursive: true });
  volume.writeFileSync("/app/packages/ui/index.js", "kept");
  return volume;
}

describe("cross-process filesystem link identity", () => {
  it("preserves relative and dangling links without flattening their targets", () => {
    for (const target of ["../../packages/ui", "/not-created-yet"]) {
      const source = fixture(), peer = fixture();
      source.symlinkSync(target, "/app/node_modules/ui");
      const change = readVFSChange(source, "app/node_modules/ui");
      expect(change.symlinkTarget).toBe(target);
      applyVFSChange(peer, change);
      expect(peer.lstatSync(change.path).isSymbolicLink()).toBe(true);
      expect(peer.readlinkSync(change.path)).toBe(target);
    }
  });

  it("updates and deletes a link without deleting its target or child links' targets", () => {
    const volume = fixture();
    const bridge = new VFSBridge(volume);
    bridge.handleWorkerSymlink("/app/node_modules/ui", "/app/packages/ui");
    bridge.handleWorkerSymlink("/app/node_modules/ui", "/not-created-yet");
    bridge.handleWorkerDelete("/app/node_modules/ui");
    expect(() => volume.lstatSync("/app/node_modules/ui")).toThrow(/ENOENT/);
    bridge.handleWorkerSymlink("/app/node_modules/ui", "/app/packages/ui");
    bridge.handleWorkerDelete("/app/node_modules");
    expect(volume.readFileSync("/app/packages/ui/index.js", "utf8")).toBe("kept");
  });

  it("broadcasts canonical links with their target and hydrates a later process", () => {
    const volume = fixture(), peer = fixture();
    const bridge = new VFSBridge(volume);
    bridge.setBroadcaster((path, content, isDirectory, _pid, symlinkTarget) => {
      applyVFSChange(peer, { path, content, isDirectory, symlinkTarget });
    });
    const unwatch = bridge.watch();
    volume.symlinkSync("/app/packages/ui", "/app/node_modules/ui");
    expect(peer.readlinkSync("/app/node_modules/ui")).toBe("/app/packages/ui");
    const later = MemoryVolume.fromBinarySnapshot(bridge.createSnapshot());
    expect(later.readFileSync("/app/node_modules/ui/index.js", "utf8")).toBe("kept");
    unwatch();
  });

  it("keeps ordinary file changes transferable even when backed by shared memory", () => {
    const volume = fixture();
    volume.writeFileSync("/bytes", new Uint8Array(new SharedArrayBuffer(3)));
    const change = readVFSChange(volume, "/bytes");
    expect(change.content).toBeInstanceOf(ArrayBuffer);
    const peer = fixture(); applyVFSChange(peer, change);
    expect(peer.readFileSync("/bytes")).toHaveLength(3);
  });

  it("retains only link metadata below lazy package directories, without reading package bytes", () => {
    const volume = fixture();
    volume.symlinkSync("/app/packages/ui", "/app/node_modules/@example/ui");
    volume.writeFileSync("/app/node_modules/not-needed.js", "large dependency source");
    const snapshot = new VFSBridge(volume).createSnapshot({ excludeDirNames: ["node_modules"] });
    expect(snapshot.manifest.some(entry => entry.path.endsWith("not-needed.js"))).toBe(false);
    const peer = MemoryVolume.fromBinarySnapshot(snapshot);
    expect(peer.readlinkSync("/app/node_modules/@example/ui")).toBe("/app/packages/ui");
    expect(peer.realpathSync("/app/node_modules/@example/ui/index.js")).toBe("/app/packages/ui/index.js");
  });
});
