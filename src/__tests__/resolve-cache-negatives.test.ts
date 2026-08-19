// A volume grows while the program reading it runs: packages are installed
// and their files materialized lazily. The resolver cached what it failed to
// find as well as what it found, so one miss — transient or simply early —
// was remembered for the life of the engine and every later attempt threw
// MODULE_NOT_FOUND without looking at the filesystem again.
//
// Node re-walks on every resolve for this reason. So does this now.

import { describe, expect, it } from "vitest";
import { MemoryVolume } from "../memory-volume";
import { ScriptEngine } from "../script-engine";

function createEngine(files: Record<string, string> = {}) {
  const vol = new MemoryVolume();
  vol.mkdirSync("/project", { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const dir = path.substring(0, path.lastIndexOf("/")) || "/";
    if (dir !== "/") vol.mkdirSync(dir, { recursive: true });
    vol.writeFileSync(path, content);
  }
  return { engine: new ScriptEngine(vol, { cwd: "/project" }), vol };
}

describe("resolution does not remember a miss", () => {
  it("finds a relative module written after a failed resolve", () => {
    const { engine, vol } = createEngine();

    expect(() =>
      engine.execute("require('./later')", "/project/first.js"),
    ).toThrow(/Cannot find module/);

    vol.writeFileSync("/project/later.js", "module.exports = 'here now'");

    const result = engine.execute(
      "module.exports = require('./later')",
      "/project/second.js",
    );
    expect(result.exports).toBe("here now");
  });

  it("finds a package installed after a failed resolve", () => {
    const { engine, vol } = createEngine();

    expect(() =>
      engine.execute("require('arrives-late')", "/project/first.js"),
    ).toThrow(/Cannot find module/);

    vol.mkdirSync("/project/node_modules/arrives-late", { recursive: true });
    vol.writeFileSync(
      "/project/node_modules/arrives-late/package.json",
      JSON.stringify({ main: "index.js", name: "arrives-late" }),
    );
    vol.writeFileSync(
      "/project/node_modules/arrives-late/index.js",
      "module.exports = 'installed'",
    );

    const result = engine.execute(
      "module.exports = require('arrives-late')",
      "/project/second.js",
    );
    expect(result.exports).toBe("installed");
  });

  it("still throws for something that never arrives", () => {
    const { engine } = createEngine();
    expect(() =>
      engine.execute("require('./nothing')", "/project/first.js"),
    ).toThrow(/Cannot find module/);
    expect(() =>
      engine.execute("require('./nothing')", "/project/second.js"),
    ).toThrow(/Cannot find module/);
  });
});
