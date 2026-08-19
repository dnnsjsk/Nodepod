// The preview bridge is framed by a page that is always cross-origin isolated,
// because Nodepod needs SharedArrayBuffer and nothing gets one otherwise. A
// cross-origin isolated document may only frame a document that carries COEP
// itself; CORP answers for subresources and says nothing about a nested
// document. Without COEP the browser refuses the bridge outright, the per-pod
// hostname is written off, and previews fall back to path URLs — which serve
// HTTP fine and lose WebSockets, so no dev server in a pod can push an update.

import { describe, expect, it } from "vitest";
import { previewBridgeResponseHeaders } from "../integrations/shared/headers";

describe("preview bridge response headers", () => {
  it("can be framed by a cross-origin isolated page", () => {
    const headers = previewBridgeResponseHeaders("text/html");
    expect(headers["Cross-Origin-Embedder-Policy"]).toBe("require-corp");
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("cross-origin");
  });

  it("carries them for the script as well as the document", () => {
    const headers = previewBridgeResponseHeaders("application/javascript");
    expect(headers["Cross-Origin-Embedder-Policy"]).toBe("require-corp");
    expect(headers["Content-Type"]).toContain("application/javascript");
  });

  it("still sets the opener policy each mode asks for", () => {
    expect(
      previewBridgeResponseHeaders("text/html", "top")[
        "Cross-Origin-Opener-Policy"
      ],
    ).toBe("same-origin-allow-popups");
    expect(
      previewBridgeResponseHeaders("text/html", "parent")[
        "Cross-Origin-Opener-Policy"
      ],
    ).toBe("unsafe-none");
    expect(
      previewBridgeResponseHeaders("text/html")["Cross-Origin-Opener-Policy"],
    ).toBeUndefined();
  });
});
