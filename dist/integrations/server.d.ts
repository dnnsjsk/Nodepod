import { Buffer } from "node:buffer";
import { DEFAULT_SW_PATH, DEFAULT_BRIDGE_HTML_PATH, DEFAULT_BRIDGE_SCRIPT_PATH } from "./shared/headers";
export { DEFAULT_SW_PATH, DEFAULT_BRIDGE_HTML_PATH, DEFAULT_BRIDGE_SCRIPT_PATH, };
export declare function getServiceWorkerSource(): Promise<string>;
/**
 * Fetch-API handler. The caller is responsible for only routing the SW
 * path here, so we don't bother looking at the request.
 *
 * @example
 *   // Hono
 *   app.get('/__sw__.js', () => serveSW())
 *
 *   // Next.js app/__sw__.js/route.ts
 *   export async function GET() { return serveSW() }
 */
export declare function serveSW(_req?: Request): Promise<Response>;
export interface NodeServeSWResult {
    body: Buffer;
    headers: Record<string, string>;
    /** Same as headers["Content-Type"], just exposed inline for convenience. */
    contentType: string;
}
/**
 * Node-native handler for Express / Fastify / bare http.createServer.
 *
 * @example
 *   app.get('/__sw__.js', async (_req, res) => {
 *     const { body, headers } = await serveSWNode();
 *     for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
 *     res.status(200).send(body);
 *   });
 */
export declare function serveSWNode(): Promise<NodeServeSWResult>;
export declare function servePreviewBridge(req?: Request): Promise<Response>;
/**
 * Top-level bootstrap response for the root of a dedicated preview hostname.
 * Route only preview-host requests here; the page installs the first-party
 * worker and reconnects it to the Nodepod host tab.
 */
export declare function servePreviewBootstrap(): Promise<Response>;
export declare function servePreviewBridgeScript(): Promise<Response>;
export declare function servePreviewBridgeNode(asset?: "html" | "script", mode?: "top" | "parent" | null): Promise<NodeServeSWResult>;
