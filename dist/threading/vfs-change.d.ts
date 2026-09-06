import type { MemoryVolume } from "../memory-volume";
export interface VFSChange {
    path: string;
    content: ArrayBuffer | null;
    isDirectory: boolean;
    symlinkTarget?: string;
}
/** Preserve links, including dangling ones, instead of copying their targets. */
export declare function readVFSChange(volume: MemoryVolume, filename: string): VFSChange;
export declare function applyVFSChange(volume: MemoryVolume, change: VFSChange): void;
