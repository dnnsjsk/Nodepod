import type { MemoryVolume } from "../memory-volume";
import { type ResolvedDependency } from "./version-resolver";
export interface LockedPackageGroup {
    root: string;
    tree: Map<string, ResolvedDependency>;
}
export interface NpmLockPlan {
    groups: LockedPackageGroup[];
    links: Array<{
        destination: string;
        target: string;
    }>;
    bundled: Array<{
        directory: string;
        name: string;
        version: string;
    }>;
}
/** Consume npm's complete placement graph; never re-resolve transitive ranges. */
export declare function readNpmLockPlan(volume: MemoryVolume, root: string): NpmLockPlan;
