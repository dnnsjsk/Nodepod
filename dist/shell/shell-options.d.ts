/**
 * Runtime policy for the virtual shell. The defaults deliberately bound memory
 * and runaway shell-language work without limiting interactive programs such
 * as dev servers and watchers by elapsed time.
 */
export interface ShellLimits {
    maxOutputBytes: number;
    maxPipelineBufferBytes: number;
    maxExpansionBytes: number;
    maxCommandSubstitutionDepth: number;
    maxRecursionDepth: number;
    maxLoopIterations: number;
    maxFilesystemEntries: number;
    maxJobs: number;
    maxProcesses: number;
    commandTimeoutMs: number;
}
export interface ShellOptions {
    limits?: Partial<ShellLimits>;
    jobControl?: boolean;
}
export declare const DEFAULT_SHELL_LIMITS: ShellLimits;
export interface ResolvedShellOptions {
    limits: ShellLimits;
    jobControl: boolean;
}
export declare function resolveShellOptions(options?: ShellOptions, parent?: ResolvedShellOptions): ResolvedShellOptions;
export declare class ShellLimitError extends Error {
    readonly limit: keyof ShellLimits;
    constructor(limit: keyof ShellLimits, message: string);
}
