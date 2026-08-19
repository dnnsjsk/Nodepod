import { MemoryVolume } from "./memory-volume";
import type { ExecutionOutcome } from "./engine-types";
import { ProcessObject } from "./polyfills/process";
export declare function setChildProcessPolyfill(mod: any): void;
export interface ModuleRecord {
    id: string;
    filename: string;
    exports: unknown;
    loaded: boolean;
    children: ModuleRecord[];
    paths: string[];
    parent: ModuleRecord | null;
}
export interface EngineOptions {
    cwd?: string;
    env?: Record<string, string>;
    onConsole?: (method: string, args: unknown[]) => void;
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    workerThreadsOverride?: {
        isMainThread: boolean;
        parentPort: unknown;
        workerData: unknown;
        threadId: number;
    };
    handler?: import("./memory-handler").MemoryHandler;
    enableSharedArrayBuffer?: boolean;
    /** Injected transform cache (e.g. the shared worker LRU). Takes precedence
     *  over `handler`'s cache. Must behave like Map<string, string>. */
    transformCache?: Map<string, string>;
}
export interface ResolverFn {
    (id: string): unknown;
    resolve: (id: string, options?: {
        paths?: string[];
    }) => string;
    cache: Record<string, ModuleRecord>;
    extensions: Record<string, unknown>;
    main: ModuleRecord | null;
    _ownerRecord?: ModuleRecord;
}
export declare class ScriptEngine {
    private vol;
    private fsBridge;
    private proc;
    private moduleRegistry;
    private opts;
    private transformCache;
    constructor(vol: MemoryVolume, opts?: EngineOptions);
    private patchTextDecoder;
    private patchStackTraceApi;
    execute(code: string, filename?: string): {
        exports: unknown;
        module: ModuleRecord;
    };
    executeSync: (code: string, filename?: string) => {
        exports: unknown;
        module: ModuleRecord;
    };
    executeAsync(code: string, filename?: string): Promise<ExecutionOutcome>;
    runFile(filename: string): {
        exports: unknown;
        module: ModuleRecord;
    };
    runFileSync: (filename: string) => {
        exports: unknown;
        module: ModuleRecord;
    };
    runFileTLA(filename: string): Promise<{
        exports: unknown;
        module: ModuleRecord;
    }>;
    private runFileTLAOnce;
    runFileAsync(filename: string): Promise<ExecutionOutcome>;
    clearCache(): void;
    /** Evict one node_modules entry when module cache exceeds soft limit. */
    private _trimModuleCache;
    getVolume(): MemoryVolume;
    getProcess(): ProcessObject;
    createREPL(): {
        eval: (code: string) => unknown;
    };
}
export declare function executeCode(code: string, vol: MemoryVolume, opts?: EngineOptions): {
    exports: unknown;
    module: ModuleRecord;
};
export type { IScriptEngine, ExecutionOutcome, EngineConfig, } from "./engine-types";
export default ScriptEngine;
/**
 * A server inside a pod listens on a port that means nothing to the network,
 * so a loopback URL naming one has to be answered by the registry that holds
 * it. `http.request` already does this; `fetch` did not, and the difference
 * is not cosmetic: a process fetching its own port reached past the pod to
 * whatever the machine hosting the browser happened to be running there, and
 * read the answer as its own. Divine renders a page by fetching its dev
 * server, so a developer with anything on that port saw someone else's
 * project on the board.
 */
export declare function loopbackTarget(url: string): URL | null;
export declare function dispatchLoopback(target: URL, input: RequestInfo | URL, init?: RequestInit): Promise<Response | null>;
