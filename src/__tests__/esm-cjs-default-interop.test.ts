// an ESM file default-importing a CommonJS module gets module.exports, the
// same as Node. __esModule only says where a module converted from ESM keeps
// its own default; a CJS module that sets the flag without defining `default`
// is still its exports object.
//
// @babel/core is exactly that shape — Object.defineProperty(exports,
// "__esModule") with every export named and no default — so
// `import babel from "@babel/core"` used to read undefined, and anything
// written that way (@tanstack/start-plugin-core, for one) threw on first use.

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

// the @babel/core shape: flagged, named exports only, no default
const BABEL_SHAPED = [
  "Object.defineProperty(exports, '__esModule', { value: true });",
  "exports.template = function template() { return 'template'; };",
  "exports.types = { identifier: function () { return 'id'; } };",
].join("\n");

function run(engine: ScriptEngine, entry: string) {
  return engine.execute(entry, "/project/__entry.js").exports;
}

describe("ESM default import of a CommonJS module", () => {
  it("is the exports object when __esModule is set without a default", () => {
    const engine = createEngine({
      "/project/babel.js": BABEL_SHAPED,
      "/project/consumer.mjs": [
        "import babel from './babel.js';",
        "export function probe() { return typeof babel.template; }",
      ].join("\n"),
    });
    expect(
      run(engine, "module.exports = require('./consumer.mjs').probe();"),
    ).toBe("function");
  });

  it("is the exports object alongside named imports from the same module", () => {
    // the two specifier shapes take different branches of the transform
    const engine = createEngine({
      "/project/babel.js": BABEL_SHAPED,
      "/project/consumer.mjs": [
        "import babel, { types } from './babel.js';",
        "export function probe() {",
        "  return [typeof babel.template, typeof types.identifier].join(',');",
        "}",
      ].join("\n"),
    });
    expect(
      run(engine, "module.exports = require('./consumer.mjs').probe();"),
    ).toBe("function,function");
  });

  it("is the exports object when re-exported as a named export", () => {
    const engine = createEngine({
      "/project/babel.js": BABEL_SHAPED,
      "/project/barrel.mjs": "export { default as babel } from './babel.js';",
      "/project/consumer.mjs": [
        "import { babel } from './barrel.mjs';",
        "export function probe() { return typeof babel.template; }",
      ].join("\n"),
    });
    expect(
      run(engine, "module.exports = require('./consumer.mjs').probe();"),
    ).toBe("function");
  });

  it("is module.exports for a plain CommonJS module with no flag", () => {
    const engine = createEngine({
      "/project/plain.js": "module.exports = function plain() { return 1; };",
      "/project/consumer.mjs": [
        "import plain from './plain.js';",
        "export function probe() { return plain(); }",
      ].join("\n"),
    });
    expect(
      run(engine, "module.exports = require('./consumer.mjs').probe();"),
    ).toBe(1);
  });

  it("is still the default export of a module converted from ESM", () => {
    // the interop that was already right has to stay right: a converted ESM
    // module keeps its default at exports.default and that is what wins
    const engine = createEngine({
      "/project/source.mjs": [
        "export const named = 'named';",
        "export default 'the-default';",
      ].join("\n"),
      "/project/consumer.mjs": [
        "import value, { named } from './source.mjs';",
        "export function probe() { return value + '/' + named; }",
      ].join("\n"),
    });
    expect(
      run(engine, "module.exports = require('./consumer.mjs').probe();"),
    ).toBe("the-default/named");
  });

  it("is an explicitly undefined default when the module exports one", () => {
    const engine = createEngine({
      "/project/source.mjs": [
        "export const named = 1;",
        "export default undefined;",
      ].join("\n"),
      "/project/consumer.mjs": [
        "import value from './source.mjs';",
        "export function probe() { return typeof value; }",
      ].join("\n"),
    });
    expect(
      run(engine, "module.exports = require('./consumer.mjs').probe();"),
    ).toBe("undefined");
  });
});
