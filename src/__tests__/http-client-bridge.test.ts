import { describe, it, expect, afterEach } from "vitest";
import { Buffer } from "../polyfills/buffer";
import {
  createServer,
  request,
  serveHost,
  serveLoopback,
  setHttpClientBridge,
  type HttpClientBridge,
} from "../polyfills/http";

describe("HTTP client bridge (cross-worker localhost)", () => {
  afterEach(() => {
    setHttpClientBridge(null);
  });

  it("routes localhost requests through bridge when port is not local", async () => {
    const remote = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer | string) =>
        chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))),
      );
      req.on("end", () => {
        res.statusCode = 200;
        res.end(Buffer.concat(chunks).toString("utf8") || "ok");
      });
    });
    remote.listen(3001);

    const bridge: HttpClientBridge = async (port, method, path, headers, body) => {
      expect(port).toBe(3000);
      return remote.dispatchRequest(method, path, headers, body);
    };

    setHttpClientBridge(bridge);

    const responseText = await new Promise<string>((resolve, reject) => {
      const req = request(
        {
          hostname: "localhost",
          port: 3000,
          path: "/echo",
          method: "POST",
          headers: { "Content-Type": "text/plain" },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer | string) =>
            chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))),
          );
          res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        },
      );
      req.on("error", reject);
      req.end("proxied-body");
    });

    remote.close();
    expect(responseText).toBe("proxied-body");
  });

  it("lets fetch fall through when no process owns the port", async () => {
    setHttpClientBridge(async () => null);

    await expect(
      serveLoopback(3000, "GET", "/outside", {}),
    ).resolves.toBeNull();
  });

  it("carries a full host target and binary body across the bridge", async () => {
    const body = Buffer.from([0, 127, 255]);
    setHttpClientBridge(async (port, method, path, headers, received, target) => {
      expect(port).toBe(443);
      expect(method).toBe("POST");
      expect(path).toBe("/api/git?service=receive");
      expect(headers.authorization).toBe("Basic secret");
      expect([...((received as Buffer) ?? [])]).toEqual([0, 127, 255]);
      expect(target).toBe("https://example.test/api/git?service=receive");
      return {
        statusCode: 200,
        statusMessage: "OK",
        headers: { "Content-Type": "application/octet-stream" },
        body,
      };
    });

    const response = await serveHost(
      new URL("https://example.test/api/git?service=receive"),
      "POST",
      { authorization: "Basic secret" },
      body,
    );

    expect(response?.body).toBe(body);
  });
});
