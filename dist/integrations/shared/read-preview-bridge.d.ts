export type PreviewBridgeAsset = "html" | "script";
export declare function readPreviewBridgeSource(fromFileUrl: string, asset: PreviewBridgeAsset): Promise<string>;
export declare function __resetPreviewBridgeSourceCacheForTests(): void;
