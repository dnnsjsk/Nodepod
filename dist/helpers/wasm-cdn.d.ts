import type { MemoryVolume } from "../memory-volume";
/**
 * NAPI-RS loaders may probe an optional `<name>.debug.wasm` next to the
 * release `<name>.wasm`. A missing debug artifact must never turn into a CDN
 * request for that filename: published packages commonly ship only release
 * WASM. Keep the mapping generic for every napi-rs WASI package.
 */
export declare function resolveWasmAssetPath(volume: MemoryVolume, vfsPath: string): string;
/**
 * Map a VFS path like `/project/node_modules/@scope/pkg/file.wasm` to its
 * jsdelivr URL, using the installed package.json version when available.
 * Returns null if the path isn't a node_modules .wasm path.
 */
export declare function buildCdnWasmUrl(volume: MemoryVolume, vfsPath: string): string | null;
export declare function isRecoverableWasmPath(vfsPath: unknown): vfsPath is string;
/**
 * Fetch a missing node_modules .wasm from the CDN, write it to the VFS, and
 * warm the compile caches. Deduplicated per path; never throws.
 */
export declare function prefetchWasmFromCdn(volume: MemoryVolume, vfsPath: string): Promise<boolean>;
