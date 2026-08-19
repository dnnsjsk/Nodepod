// A shallow snapshot leaves node_modules out and reinstalls from the manifest
// on the way back in. It used to reinstall only what `dependencies` names, so
// a project whose bundler is a devDependency — which is most of them — came
// back unable to build the source it had just restored.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserHost, resetRuntimeHost, setRuntimeHost } from "../host";
import { Nodepod } from "../sdk/nodepod";

describe("restoring a shallow snapshot", () => {
  let workerWasSet = false;

  beforeEach(() => {
    resetRuntimeHost();
    setRuntimeHost(createBrowserHost());
    if (typeof (globalThis as any).Worker === "undefined") {
      (globalThis as any).Worker = function MockWorker() {} as any;
      workerWasSet = true;
    }
  });

  afterEach(() => {
    resetRuntimeHost();
    if (workerWasSet) {
      delete (globalThis as any).Worker;
      workerWasSet = false;
    }
  });

  it("reinstalls the dev dependencies that shallow left out", async () => {
    const pod = await Nodepod.boot({
      enableSnapshotCache: false,
      files: {
        "/package.json": JSON.stringify({
          devDependencies: { vite: "8.2.1" },
          name: "restored",
          version: "1.0.0",
        }),
      },
      headless: true,
      packageStore: "memory",
    });

    const install = vi
      .spyOn(pod.packages, "installFromManifest")
      .mockResolvedValue({ newPackages: [], resolved: new Map() });

    await pod.restore(pod.snapshot({ shallow: true }));

    expect(install).toHaveBeenCalledTimes(1);
    expect(install.mock.calls[0]?.[1]).toMatchObject({ withDevDeps: true });

    pod.teardown();
  });

  it("does not install at all when asked not to", async () => {
    const pod = await Nodepod.boot({
      enableSnapshotCache: false,
      files: { "/package.json": JSON.stringify({ name: "restored" }) },
      headless: true,
      packageStore: "memory",
    });

    const install = vi
      .spyOn(pod.packages, "installFromManifest")
      .mockResolvedValue({ newPackages: [], resolved: new Map() });

    await pod.restore(pod.snapshot({ shallow: true }), { autoInstall: false });

    expect(install).not.toHaveBeenCalled();
    pod.teardown();
  });
});
