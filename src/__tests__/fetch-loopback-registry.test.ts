import { describe, expect, it } from "vitest";
import { createServer } from "../polyfills/http";
import { dispatchLoopback, loopbackTarget } from "../script-engine";

describe("loopbackTarget", () => {
  it("recognises every spelling of this machine", () => {
    for (const url of [
      "http://localhost:5173/",
      "http://127.0.0.1:5173/",
      "http://0.0.0.0:5173/",
      "http://[::1]:5173/",
    ]) {
      expect(loopbackTarget(url), url).not.toBeNull();
    }
  });

  it("leaves anything else to the network", () => {
    expect(loopbackTarget("https://registry.npmjs.org/vite")).toBeNull();
    expect(loopbackTarget("file:///tmp/x.wasm")).toBeNull();
    expect(loopbackTarget("not a url at all")).toBeNull();
  });
});

describe("dispatchLoopback", () => {
  it("answers from the server inside the pod, not from the network", async () => {
    const port = 45411;
    const server = createServer((_request: any, response: any) => {
      response.statusCode = 201;
      response.end("from the pod");
    });
    await new Promise<void>((resolve) => server.listen(port, () => resolve()));
    try {
      const target = loopbackTarget(`http://localhost:${port}/page`);
      expect(target).not.toBeNull();
      const answer = await dispatchLoopback(
        target as URL,
        `http://localhost:${port}/page`,
      );
      expect(answer).not.toBeNull();
      expect(answer?.status).toBe(201);
      expect(await (answer as Response).text()).toBe("from the pod");
    } finally {
      server.close();
    }
  });

  /* Nothing in the pod is on that port and no other process owns one, so
     the network is the right answer after all and the caller falls through. */
  it("declines a port the pod is not serving", async () => {
    const target = loopbackTarget("http://localhost:45412/");
    expect(await dispatchLoopback(target as URL, "http://localhost:45412/")).toBeNull();
  });
});
