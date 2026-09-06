import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { MemoryVolume } from "../memory-volume";
import { readNpmLockPlan } from "../packages/package-lock";
import { DependencyInstaller } from "../packages/installer";
import { packTarGz } from "../packages/tar-pack";

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const volume = new MemoryVolume();
  const root = { name: "lock-fixture", version: "1.0.0", private: true,
    workspaces: ["packages/*"], dependencies: { "@example/ui": "file:packages/ui", react: "1.0.0", other: "1.0.0" } };
  const ui = { name: "@example/ui", version: "0.0.0", private: true, dependencies: { react: "^1.0.0" } };
  const archives = new Map<string, Uint8Array>();
  function registry(name: string, version: string, dependencies: Record<string, string> = {}) {
    const bytes = packTarGz([
      { path: "package/package.json", content: JSON.stringify({ name, version, dependencies }) },
      { path: "package/index.js", content: `module.exports = '${name}@${version}'` },
    ]);
    const resolved = `https://locked-${Math.random().toString(36).slice(2)}.example.test/${name}-${version}.tgz`;
    archives.set(resolved, bytes);
    return { version, resolved, dependencies, integrity: "sha512-" + createHash("sha512").update(bytes).digest("base64") };
  }
  const lock = { lockfileVersion: 3, packages: {
    "": root,
    "packages/ui": ui,
    "node_modules/@example/ui": { link: true, resolved: "packages/ui" },
    "node_modules/react": registry("react", "1.0.0"),
    "node_modules/other": registry("other", "1.0.0", { react: "2.0.0" }),
    "node_modules/other/node_modules/react": registry("react", "2.0.0"),
  } as Record<string, any> };
  volume.mkdirSync("/app/packages/ui", { recursive: true });
  volume.writeFileSync("/app/package.json", JSON.stringify(root));
  volume.writeFileSync("/app/packages/ui/package.json", JSON.stringify(ui));
  volume.writeFileSync("/app/packages/ui/index.js", "module.exports = require('react')");
  const save = () => volume.writeFileSync("/app/package-lock.json", JSON.stringify(lock));
  save();
  return { volume, root, ui, lock, save, archives };
}

describe("exact npm workspace lock installation", () => {
  it("retains hoisted and nested versions and carries local workspace links", () => {
    const { volume } = fixture();
    const plan = readNpmLockPlan(volume, "/app");
    expect([...plan.groups[0].tree.keys()]).toEqual(["react", "other", "other/node_modules/react"]);
    expect(plan.groups[0].tree.get("react")?.version).toBe("1.0.0");
    expect(plan.groups[0].tree.get("other/node_modules/react")?.version).toBe("2.0.0");
    expect(plan.links).toEqual([{ destination: "/app/node_modules/@example/ui", target: "/app/packages/ui" }]);
  });

  it("installs only locked archives, verifies SRI, and leaves accepted inputs byte-identical", async () => {
    const { volume, archives } = fixture();
    const lockBefore = volume.readFileSync("/app/package-lock.json", "utf8");
    const rootBefore = volume.readFileSync("/app/package.json", "utf8");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const bytes = archives.get(String(input));
      if (!bytes) throw new Error("Unreviewed registry request: " + String(input));
      return new Response(new Uint8Array(bytes).buffer, { headers: { "content-type": "application/octet-stream" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await new DependencyInstaller(volume, { cwd: "/app" }).installFromLockfile();
    expect(result.newPackages).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(volume.readlinkSync("/app/node_modules/@example/ui")).toBe("/app/packages/ui");
    expect(volume.readFileSync("/app/node_modules/react/index.js", "utf8")).toContain("react@1.0.0");
    expect(volume.readFileSync("/app/node_modules/other/node_modules/react/index.js", "utf8")).toContain("react@2.0.0");
    expect(volume.readFileSync("/app/package-lock.json", "utf8")).toBe(lockBefore);
    expect(volume.readFileSync("/app/package.json", "utf8")).toBe(rootBefore);
    await new DependencyInstaller(volume, { cwd: "/app" }).installFromLockfile();
    expect(volume.readlinkSync("/app/node_modules/@example/ui")).toBe("/app/packages/ui");
  });

  it("rejects stale workspace declarations before removing any installed data", async () => {
    const { volume, ui } = fixture();
    volume.mkdirSync("/app/node_modules", { recursive: true });
    volume.writeFileSync("/app/node_modules/sentinel", "unchanged");
    volume.writeFileSync("/app/packages/ui/package.json", JSON.stringify({ ...ui, dependencies: { react: "2.0.0" } }));
    await expect(new DependencyInstaller(volume, { cwd: "/app" }).installFromLockfile()).rejects.toThrow("does not match");
    expect(volume.readFileSync("/app/node_modules/sentinel", "utf8")).toBe("unchanged");
  });

  it("rejects escaping, undeclared and substituted workspace links", () => {
    for (const target of ["../outside", "/outside", "packages/missing", "packages/ui/../ui"]) {
      const f = fixture();
      f.lock.packages["node_modules/@example/ui"].resolved = target;
      f.save();
      expect(() => readNpmLockPlan(f.volume, "/app")).toThrow("declared workspace");
    }
    for (const key of ["node_modules/../../outside", "packages/missing/node_modules/x", "node_modules/a//b", "node_modules/a\\b"]) {
      const f = fixture();
      f.lock.packages[key] = f.lock.packages["node_modules/react"];
      f.save();
      expect(() => readNpmLockPlan(f.volume, "/app")).toThrow();
    }
  });

  it("rejects missing root and transitive placements and mismatching pinned versions", () => {
    for (const key of ["node_modules/react", "node_modules/other", "node_modules/other/node_modules/react", "node_modules/@example/ui"]) {
      const f = fixture(); delete f.lock.packages[key]; f.save();
      expect(() => readNpmLockPlan(f.volume, "/app")).toThrow();
    }
    const f = fixture(); f.lock.packages["node_modules/react"].version = "3.0.0"; f.save();
    expect(() => readNpmLockPlan(f.volume, "/app")).toThrow("does not satisfy");
  });

  it("does not fetch credentials or accept unhashed registry archives", () => {
    for (const resolved of ["file:/private/archive", "http://registry.test/a.tgz", "https://user:secret@registry.test/a.tgz"]) {
      const f = fixture(); f.lock.packages["node_modules/react"].resolved = resolved; f.save();
      expect(() => readNpmLockPlan(f.volume, "/app")).toThrow("credential-free HTTPS");
    }
    const f = fixture(); delete f.lock.packages["node_modules/react"].integrity; f.save();
    expect(() => readNpmLockPlan(f.volume, "/app")).toThrow("integrity");
  });

  it("rejects an archive whose bytes do not match the locked integrity", async () => {
    const f = fixture();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const bytes = f.archives.get(String(input));
      return new Response(bytes ? bytes.slice(0, bytes.length - 1) : new Uint8Array());
    }));
    await expect(new DependencyInstaller(f.volume, { cwd: "/app" }).installFromLockfile()).rejects.toThrow(/integrity|mismatch/i);
  });

  it("inherits bundled-dependency integrity from the parent archive and verifies identity", async () => {
    const f = fixture();
    const owner = f.lock.packages["node_modules/other"];
    const archive = packTarGz([
      { path: "package/package.json", content: JSON.stringify({ name: "other", version: "1.0.0" }) },
      { path: "package/node_modules/bundled/package.json", content: JSON.stringify({ name: "bundled", version: "1.0.0" }) },
      { path: "package/node_modules/bundled/index.js", content: "module.exports = 42" },
    ]);
    f.archives.set(owner.resolved, archive);
    owner.integrity = "sha512-" + createHash("sha512").update(archive).digest("base64");
    owner.dependencies.bundled = "1.0.0";
    f.lock.packages["node_modules/other/node_modules/bundled"] = { inBundle: true, version: "1.0.0" };
    f.save();
    const plan = readNpmLockPlan(f.volume, "/app");
    expect(plan.bundled).toEqual([{ directory: "/app/node_modules/other/node_modules/bundled", name: "bundled", version: "1.0.0" }]);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const bytes = f.archives.get(String(input));
      if (!bytes) throw new Error("Unexpected request for a bundled package");
      return new Response(new Uint8Array(bytes).buffer);
    }));
    await new DependencyInstaller(f.volume, { cwd: "/app" }).installFromLockfile();
    expect(f.volume.readFileSync("/app/node_modules/other/node_modules/bundled/index.js", "utf8")).toContain("42");
    f.lock.packages["node_modules/other/node_modules/bundled"].version = "2.0.0";
    owner.dependencies.bundled = "2.0.0";
    f.save();
    await expect(new DependencyInstaller(f.volume, { cwd: "/app" }).installFromLockfile()).rejects.toThrow("Bundled archive identity mismatch");
  });

  it("rejects orphan bundles and distinguishes optional native packages from required ones", () => {
    const f = fixture();
    f.lock.packages["node_modules/orphan"] = { inBundle: true, version: "1.0.0" };
    f.save();
    expect(() => readNpmLockPlan(f.volume, "/app")).toThrow("integrity-verified parent");
    delete f.lock.packages["node_modules/orphan"];
    f.lock.packages["node_modules/native"] = { ...f.lock.packages["node_modules/react"], cpu: ["x64"], os: ["linux"], optional: true };
    f.save();
    expect(readNpmLockPlan(f.volume, "/app").groups[0].tree.has("native")).toBe(false);
    f.lock.packages["node_modules/native"].optional = false;
    f.save();
    expect(() => readNpmLockPlan(f.volume, "/app")).toThrow("does not support the browser runtime");
  });

  it("keeps the lock's workspace-local dependency placement distinct from the root", () => {
    const f = fixture();
    f.ui.dependencies.react = "2.0.0";
    f.volume.writeFileSync("/app/packages/ui/package.json", JSON.stringify(f.ui));
    f.lock.packages["packages/ui/node_modules/react"] = f.lock.packages["node_modules/other/node_modules/react"];
    f.save();
    const plan = readNpmLockPlan(f.volume, "/app");
    expect(plan.groups[0].tree.get("react")?.version).toBe("1.0.0");
    expect(plan.groups[1].tree.get("react")?.version).toBe("2.0.0");
  });

  it("supports v2 and empty v3 trees without resolving a newer package", async () => {
    const f = fixture(); f.lock.lockfileVersion = 2; f.save();
    expect(readNpmLockPlan(f.volume, "/app").links).toHaveLength(1);
    const volume = new MemoryVolume(); volume.mkdirSync("/empty");
    volume.writeFileSync("/empty/package.json", '{"name":"empty"}');
    volume.writeFileSync("/empty/package-lock.json", '{"lockfileVersion":3,"packages":{"":{"name":"empty"}}}');
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await new DependencyInstaller(volume, { cwd: "/empty" }).installFromLockfile()).newPackages).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates required peers and present optional dependencies against the locked versions", () => {
    const f = fixture();
    f.lock.packages["node_modules/other"].peerDependencies = { missing: "1.0.0" };
    f.save();
    expect(() => readNpmLockPlan(f.volume, "/app")).toThrow("missing required dependency missing");
    f.lock.packages["node_modules/other"].peerDependenciesMeta = { missing: { optional: true } };
    f.save();
    expect(() => readNpmLockPlan(f.volume, "/app")).not.toThrow();
    f.lock.packages["node_modules/other"].optionalDependencies = { react: "3.0.0" };
    f.save();
    expect(() => readNpmLockPlan(f.volume, "/app")).toThrow("does not satisfy 3.0.0");
    delete f.lock.packages["node_modules/other"].optionalDependencies;
    f.lock.packages["node_modules/other"].version = "latest";
    f.save();
    expect(() => readNpmLockPlan(f.volume, "/app")).toThrow("exact version");
  });
});
