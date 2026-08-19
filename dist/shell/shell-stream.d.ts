/** Small dependency-free async byte stream used by shell pipelines. */
import type { ShellLimits } from "./shell-options";
export interface CancellationToken {
    readonly signal: AbortSignal;
    throwIfCancelled(): void;
    onCancel(listener: () => void): () => void;
}
export interface ShellReadable {
    read(token?: CancellationToken): Promise<Uint8Array | null>;
}
export interface ShellWritable {
    write(chunk: Uint8Array, token?: CancellationToken): Promise<void>;
    end(): void;
}
export interface ExecutionContext {
    cwd: string;
    env: Record<string, string>;
    signal: AbortSignal;
    limits: ShellLimits;
}
export interface ProcessGroup {
    readonly id: number;
    readonly signal: AbortSignal;
    cancel(reason?: unknown): void;
}
export declare class JobTable<T extends {
    id: number;
}> {
    private readonly jobs;
    set(job: T): void;
    get(id: number): T | undefined;
    delete(id: number): boolean;
    values(): IterableIterator<T>;
    get size(): number;
}
export declare class ShellCancellation implements CancellationToken {
    readonly controller: AbortController;
    get signal(): AbortSignal;
    cancel(reason?: unknown): void;
    throwIfCancelled(): void;
    onCancel(listener: () => void): () => void;
}
/**
 * A bounded async queue. Producers wait when the queue is full, which gives
 * shell pipelines real backpressure instead of concatenating unbounded
 * strings in memory.
 */
export declare class ShellPipe implements ShellReadable, ShellWritable {
    private readonly capacity;
    private readonly chunks;
    private readonly readers;
    private readonly writers;
    private bytes;
    private ended;
    private failure;
    constructor(capacity: number);
    get bufferedBytes(): number;
    get capacityBytes(): number;
    get closed(): boolean;
    write(chunk: Uint8Array, token?: CancellationToken): Promise<void>;
    read(token?: CancellationToken): Promise<Uint8Array | null>;
    end(): void;
    fail(error: unknown): void;
    private waitForWriter;
    private releaseWriter;
}
export declare function streamToString(pipe: ShellPipe, token: CancellationToken, maxBytes: number): Promise<string>;
export declare function stringToBytes(value: string): Uint8Array;
