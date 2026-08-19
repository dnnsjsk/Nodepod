import type { ShellResult } from "./shell-types";
import * as pathModule from "../polyfills/path";
export declare const RESET = "\u001B[0m";
export declare const DIM = "\u001B[2m";
export declare const GREEN = "\u001B[32m";
export declare const MAGENTA = "\u001B[35m";
export declare const CYAN = "\u001B[36m";
export declare const BOLD_BLUE = "\u001B[1;34m";
export declare const BOLD_RED = "\u001B[1;31m";
export declare const ok: (stdout?: string) => ShellResult;
export declare const fail: (stderr: string, code?: number) => ShellResult;
export declare const EXIT_OK: ShellResult;
export declare const EXIT_FAIL: ShellResult;
/**
 * Yield to the browser task queue so timers, input, and AbortSignal handlers
 * can run during large virtual-shell operations. A resolved Promise only
 * yields to the microtask queue and can still starve the page indefinitely.
 */
export declare function yieldToEventLoop(signal?: AbortSignal): Promise<void>;
/** Schedule delays longer than the browser's 32-bit setTimeout range safely. */
export declare function scheduleLongTimeout(callback: () => void, delayMs: number): () => void;
export declare function waitForShellDelay(delayMs: number, signal?: AbortSignal): Promise<boolean>;
export declare const MONTHS_SHORT: readonly ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export declare const MONTHS_LONG: readonly ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export declare const DAYS_SHORT: readonly ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export declare const DAYS_LONG: readonly ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export declare function resolvePath(p: string, cwd: string): string;
export { pathModule };
export declare function parseArgs(args: string[], knownFlags: string[], knownOpts?: string[]): {
    flags: Set<string>;
    opts: Record<string, string>;
    positional: string[];
};
export declare function expandCharClass(s: string): string;
export declare function processEscapes(s: string): string;
export declare function humanSize(bytes: number): string;
export declare function globToRegex(pattern: string): string;
/** Reject the most common catastrophic-backtracking shape before using JS RegExp. */
export declare function regexSafetyError(pattern: string, maxLength?: number): string | null;
