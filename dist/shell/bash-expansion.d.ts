import type { MemoryVolume } from "../memory-volume";
import type { ShellLimits } from "./shell-options";
export interface BashExpansionContext {
    env: Record<string, string>;
    cwd: string;
    volume: MemoryVolume;
    lastExit: number;
    positional: string[];
    lastBackgroundPid: number;
    shellName?: string;
    pipeStatuses: number[];
    nounset?: boolean;
    limits: ShellLimits;
    globOptions?: {
        enabled?: boolean;
        nullglob?: boolean;
        dotglob?: boolean;
    };
    commandSubstitution: (command: string) => Promise<{
        stdout: string;
        exitCode: number;
    }>;
    processSubstitution?: (command: string, mode: "read" | "write") => Promise<string>;
}
export declare function expandWord(raw: string, ctx: BashExpansionContext): Promise<string[]>;
export declare function expandWords(words: string[], ctx: BashExpansionContext): Promise<string[]>;
/** Expand an unquoted here-document body without word splitting or globbing. */
export declare function expandHereDocument(text: string, ctx: BashExpansionContext): Promise<string>;
