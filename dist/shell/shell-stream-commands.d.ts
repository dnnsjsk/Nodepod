import type { MemoryVolume } from "../memory-volume";
import { ShellPipe, type CancellationToken } from "./shell-stream";
export interface StreamCommandContext {
    cwd: string;
    env: Record<string, string>;
    volume: MemoryVolume;
    input: ShellPipe | null;
    output: ShellPipe;
    token: CancellationToken;
    maxOutputBytes: number;
    maxLoopIterations: number;
    cancelUpstream: () => void;
}
export interface StreamCommandResult {
    exitCode: number;
    stderr: string;
}
export declare function canonicalVirtualCommandName(name: string): string;
export declare function isStreamableCommand(name: string): boolean;
export declare function runStreamCommand(name: string, args: string[], ctx: StreamCommandContext): Promise<StreamCommandResult>;
