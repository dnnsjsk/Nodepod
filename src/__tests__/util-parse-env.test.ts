// util.parseEnv reads the dotenv format. Every expectation here is Node's own
// output for the same input, taken from node:util on Node 22.
//
// Vite calls this to load .env, so a project with one could not be built or
// served without it.

import { describe, expect, it } from "vitest";
import { parseEnv } from "../polyfills/util";

describe("util.parseEnv", () => {
  it("reads plain assignments", () => {
    expect(parseEnv("A=1\nB=two")).toEqual({ A: "1", B: "two" });
  });

  it("skips blank lines and whole-line comments", () => {
    expect(parseEnv("# a comment\n\nA=1\n\n# another\nB=2")).toEqual({
      A: "1",
      B: "2",
    });
  });

  it("ends an unquoted value at a comment", () => {
    expect(parseEnv("A=1 # trailing")).toEqual({ A: "1" });
  });

  it("strips double, single and backtick quotes", () => {
    expect(parseEnv('A="dq"\nB=\'sq\'\nC=`bt`')).toEqual({
      A: "dq",
      B: "sq",
      C: "bt",
    });
  });

  it("lets a quoted value span lines", () => {
    expect(parseEnv('A="line1\nline2"')).toEqual({ A: "line1\nline2" });
  });

  it("keeps a # inside a quoted value", () => {
    expect(parseEnv('A="not # a comment"')).toEqual({ A: "not # a comment" });
  });

  it("trims an unquoted value and its key", () => {
    expect(parseEnv("A = spaced \nB=  trimmed  ")).toEqual({
      A: "spaced",
      B: "trimmed",
    });
  });

  it("drops an export prefix", () => {
    expect(parseEnv("export A=1")).toEqual({ A: "1" });
  });

  it("reads an empty value as an empty string", () => {
    expect(parseEnv("A=\nB=")).toEqual({ A: "", B: "" });
  });

  it("keeps an equals sign inside a value", () => {
    expect(parseEnv("A=a=b")).toEqual({ A: "a=b" });
  });

  it("lets the last assignment win", () => {
    expect(parseEnv("A=1\nA=2")).toEqual({ A: "2" });
  });

  it("ignores a line with no assignment", () => {
    expect(parseEnv("A")).toEqual({});
  });

  it("reads CRLF line endings", () => {
    expect(parseEnv("A=1\r\nB=2\r\n")).toEqual({ A: "1", B: "2" });
  });

  it("is reachable from the default export", async () => {
    const util = (await import("../polyfills/util")).default;
    expect(typeof util.parseEnv).toBe("function");
  });
});
