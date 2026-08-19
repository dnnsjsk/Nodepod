export declare function forkChild(modulePath: string, args: string[], opts: {
    cwd: string;
    env: Record<string, string>;
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    onIPC?: (data: unknown) => void;
    onExit?: (exitCode: number) => void;
}): {
    sendIPC: (data: unknown) => void;
    disconnect: () => void;
    kill: (signal?: string) => boolean;
    requestId: number;
};
export declare function spawnChild(command: string, args: string[], opts?: {
    cwd?: string;
    env?: Record<string, string>;
    stdio?: "pipe" | "inherit" | Array<"pipe" | "inherit" | "ignore">;
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
}): import("../polyfills/child_process").SpawnChildOperation;
