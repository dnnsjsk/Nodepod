export interface ESMToCJSOptions {
    /** Target used for pure default exports. */
    exportTarget?: string;
}
export declare function esmToCjs(code: string, options?: ESMToCJSOptions): string;
export declare function collectEsmCjsPatches(ast: any, code: string, patches: Array<[number, number, string]>, options?: ESMToCJSOptions): void;
export declare function hasTopLevelAwait(code: string): boolean;
export declare function stripTopLevelAwait(code: string, mode?: "topLevelOnly" | "full"): string;
