// #56 hoists `exports.X = X` for `export function X` so a module in a circular
// import publishes its functions before it imports the module waiting on them.
// A bundler does not write that shape: rolldown, esbuild and tsup all emit the
// declarations first and one `export { a, b, c }` at the end of the file, which
// landed after the cycle had already captured undefined.
//
// @tanstack/start-plugin-core is built that way and its import-protection
// analysis.js <-> sourceLocation.js pair is a cycle, so TanStack Start's dev
// server threw "buildLineIndex is not a function" on the first request.

import { describe, expect, it } from "vitest";
import { MemoryVolume } from "../memory-volume";
import { ScriptEngine } from "../script-engine";

function createEngine(files: Record<string, string>) {
  const vol = new MemoryVolume();
  vol.mkdirSync("/project", { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const dir = path.substring(0, path.lastIndexOf("/")) || "/";
    if (dir !== "/") vol.mkdirSync(dir, { recursive: true });
    vol.writeFileSync(path, content);
  }
  return new ScriptEngine(vol, { cwd: "/project" });
}

function run(engine: ScriptEngine, entry: string) {
  return engine.execute(entry, "/project/__entry.js").exports;
}

describe("circular ESM with bundler-style trailing exports", () => {
  it("publishes a function listed in a trailing export before the cycle", () => {
    const engine = createEngine({
      "/project/analysis.mjs": [
        "import { buildLineIndex } from './source-location.mjs';",
        "function analyse(code) { return buildLineIndex(code); }",
        "export { analyse };",
      ].join("\n"),
      "/project/source-location.mjs": [
        "import { analyse } from './analysis.mjs';",
        "function buildLineIndex(code) { return code.split('\\n').length; }",
        "function describeCode(code) { return analyse(code); }",
        "export { buildLineIndex, describeCode };",
      ].join("\n"),
    });
    expect(
      run(
        engine,
        "module.exports = require('./source-location.mjs').describeCode('a\\nb');",
      ),
    ).toBe(2);
  });

  it("publishes it under the name the export renamed it to", () => {
    const engine = createEngine({
      "/project/analysis.mjs": [
        "import { buildIndex } from './source-location.mjs';",
        "function analyse(code) { return buildIndex(code); }",
        "export { analyse };",
      ].join("\n"),
      "/project/source-location.mjs": [
        "import { analyse } from './analysis.mjs';",
        "function buildLineIndex(code) { return code.split('\\n').length; }",
        "function describeCode(code) { return analyse(code); }",
        "export { buildLineIndex as buildIndex, describeCode };",
      ].join("\n"),
    });
    expect(
      run(
        engine,
        "module.exports = require('./source-location.mjs').describeCode('a\\nb\\nc');",
      ),
    ).toBe(3);
  });

  it("leaves a trailing export of a const where it was written", () => {
    // only function declarations are value-hoisted; a const is in its TDZ
    // until the declaration runs, so hoisting one would throw rather than
    // read undefined
    const engine = createEngine({
      "/project/constants.mjs": [
        "const LIMIT = 10;",
        "function limit() { return LIMIT; }",
        "export { LIMIT, limit };",
      ].join("\n"),
      "/project/consumer.mjs": [
        "import { LIMIT, limit } from './constants.mjs';",
        "export function probe() { return LIMIT + limit(); }",
      ].join("\n"),
    });
    expect(
      run(engine, "module.exports = require('./consumer.mjs').probe();"),
    ).toBe(20);
  });

  it("keeps a trailing `export { x as default }` out of the hoist", () => {
    const engine = createEngine({
      "/project/source.mjs": [
        "function value() { return 'defaulted'; }",
        "export { value as default };",
      ].join("\n"),
      "/project/consumer.mjs": [
        "import value from './source.mjs';",
        "export function probe() { return value(); }",
      ].join("\n"),
    });
    expect(
      run(engine, "module.exports = require('./consumer.mjs').probe();"),
    ).toBe("defaulted");
  });
});
