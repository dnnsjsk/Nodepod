export declare const DEFAULT_SW_PATH = "/__sw__.js";
export declare const DEFAULT_BRIDGE_HTML_PATH = "/__nodepod_bridge__.html";
export declare const DEFAULT_BRIDGE_SCRIPT_PATH = "/__nodepod_bridge__.js";
/**
 * Headers for the nodepod service worker response.
 *
 * Content-Type must be a JS type or browsers silently refuse to register
 * the SW (the common failure mode is SPA dev servers serving text/html
 * as a fallback and quietly breaking things).
 *
 * Service-Worker-Allowed: / lets the SW control the whole origin even if
 * the script itself lives under a nested path.
 *
 * Cache-Control: no-cache pairs with the `?v=${Date.now()}` cache-buster
 * the SDK appends on register(), so upgrades don't get a stale SW.
 */
export declare function swResponseHeaders(): Record<string, string>;
/**
 * Headers for the preview bridge document and its script.
 *
 * Cross-Origin-Embedder-Policy is not optional here. Nodepod needs
 * SharedArrayBuffer, so the page hosting it is always cross-origin isolated,
 * and a cross-origin isolated document may only frame another document that
 * carries COEP itself — Cross-Origin-Resource-Policy answers for subresources
 * and says nothing about a nested document. Without it the browser refuses the
 * bridge iframe with ERR_BLOCKED_BY_RESPONSE, the per-pod hostname is written
 * off as unavailable, and previews fall back to path URLs on the host's own
 * origin. That fallback works for HTTP and quietly loses WebSockets: the
 * injected shim recognises a pod socket by its origin, and on the host's
 * origin there is nothing to recognise, so a dev server's HMR socket connects
 * to the host instead and no update ever arrives.
 */
export declare function previewBridgeResponseHeaders(contentType: string, mode?: "top" | "parent" | null): Record<string, string>;
