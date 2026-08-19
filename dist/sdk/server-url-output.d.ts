/**
 * Rewrites loopback server URLs in terminal display text without changing
 * raw process output, the process environment, or the server itself.
 *
 * Resolver contract:
 *   string    preview URL is ready
 *   null      this is a Nodepod server, but its preview bridge is pending
 *   undefined the port is not owned by this Nodepod
 */
export type TerminalServerUrlResolver = (port: number) => string | null | undefined;
export interface ServerUrlRewriteResult {
    text: string;
    pending: boolean;
}
export declare function rewriteTerminalServerUrlsInText(input: string, resolve: TerminalServerUrlResolver): ServerUrlRewriteResult;
/** Stateful presentation adapter for terminal output split across chunks. */
export declare class TerminalServerUrlOutputStream {
    private readonly resolve;
    private readonly emit;
    private readonly enabled;
    private static readonly MAX_BUFFERED_OUTPUT;
    private static readonly PENDING_URL_WAIT_MS;
    private static readonly PARTIAL_URL_WAIT_MS;
    private buffer;
    private partialTimer;
    private pendingTimer;
    private ended;
    constructor(resolve: TerminalServerUrlResolver, emit: (text: string) => void, enabled?: boolean);
    push(chunk: string): void;
    /** Retry buffered output after a preview URL becomes ready. */
    notifyResolution(): void;
    end(): void;
    private drain;
    private clearTimers;
}
