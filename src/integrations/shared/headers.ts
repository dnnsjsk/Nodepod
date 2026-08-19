// One place for the headers used when serving __sw__.js, so Vite, Next and
// the generic server handler can't drift apart.

export const DEFAULT_SW_PATH = "/__sw__.js";
export const DEFAULT_BRIDGE_HTML_PATH = "/__nodepod_bridge__.html";
export const DEFAULT_BRIDGE_SCRIPT_PATH = "/__nodepod_bridge__.js";

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
export function swResponseHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/javascript; charset=utf-8",
    "Service-Worker-Allowed": "/",
    "Cache-Control": "no-cache",
  };
}

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
export function previewBridgeResponseHeaders(
  contentType: string,
  mode?: "top" | "parent" | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": `${contentType}; charset=utf-8`,
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Cache-Control": "no-store",
  };
  if (mode === "top") {
    headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups";
  } else if (mode === "parent") {
    headers["Cross-Origin-Opener-Policy"] = "unsafe-none";
  }
  return headers;
}
