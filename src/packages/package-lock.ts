import type { MemoryVolume } from "../memory-volume";
import * as path from "../polyfills/path";
import { discoverWorkspaces } from "./workspace";
import { parseSemver, satisfiesRange, type ResolvedDependency } from "./version-resolver";

export interface LockedPackageGroup {
  root: string;
  tree: Map<string, ResolvedDependency>;
}

export interface NpmLockPlan {
  groups: LockedPackageGroup[];
  links: Array<{ destination: string; target: string }>;
  bundled: Array<{ directory: string; name: string; version: string }>;
}

type RecordValue = Record<string, unknown>;
const PACKAGE_NAME = /^(?:@[a-zA-Z0-9._~-]+\/)?[a-zA-Z0-9._~-]+$/u;

function record(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label} in package-lock.json`);
  }
  return value as RecordValue;
}

function relativePath(value: string): boolean {
  return value.length > 0 && value.length <= 2048 &&
    !/[\\\u0000-\u001f]/u.test(value) &&
    value.split("/").every(part => part !== "" && part !== "." && part !== "..");
}

function dependencyRecord(value: unknown, label: string): Record<string, string> {
  if (value === undefined) return {};
  const result = record(value, label);
  if (Object.entries(result).some(([name, spec]) => !PACKAGE_NAME.test(name) || typeof spec !== "string")) {
    throw new Error(`Invalid ${label} dependency specifier`);
  }
  return result as Record<string, string>;
}

function sortedRecord(value: unknown, label: string): string {
  return JSON.stringify(Object.entries(dependencyRecord(value, label)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

function checkManifest(actual: RecordValue, locked: RecordValue, label: string): void {
  for (const field of ["name", "version"]) {
    // npm omits the workspace name from some v3 records.
    if (locked[field] !== undefined && actual[field] !== locked[field]) {
      throw new Error(`package-lock.json does not match ${label} ${field}`);
    }
  }
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    if (sortedRecord(actual[section], label) !== sortedRecord(locked[section], label)) {
      throw new Error(`package-lock.json does not match ${label} ${section}`);
    }
  }
}

function allowsPlatform(value: unknown, current: string): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) {
    throw new Error("Invalid locked package platform restriction");
  }
  if (value.includes(`!${current}`)) return false;
  const positive = value.filter(item => !item.startsWith("!"));
  return positive.length === 0 || positive.includes(current) || positive.includes("any");
}

/** Consume npm's complete placement graph; never re-resolve transitive ranges. */
export function readNpmLockPlan(volume: MemoryVolume, root: string): NpmLockPlan {
  const normalizedRoot = path.resolve(root);
  const manifest = record(JSON.parse(volume.readFileSync(path.join(normalizedRoot, "package.json"), "utf8")), "root manifest");
  const lock = record(JSON.parse(volume.readFileSync(path.join(normalizedRoot, "package-lock.json"), "utf8")), "lockfile");
  if (lock.lockfileVersion !== 2 && lock.lockfileVersion !== 3) {
    throw new Error("Locked tree installation requires npm lockfile version 2 or 3");
  }
  const packages = record(lock.packages, "packages");
  if (Object.keys(packages).length > 20_000) throw new Error("Package lock exceeds 20,000 placements");
  const lockedRoot = record(packages[""], "root package");
  checkManifest(manifest, lockedRoot, "root package");
  if (JSON.stringify(manifest.workspaces ?? []) !== JSON.stringify(lockedRoot.workspaces ?? [])) {
    throw new Error("package-lock.json does not match root workspaces");
  }
  const graph = discoverWorkspaces(volume, normalizedRoot);
  const roots = new Set([normalizedRoot]);
  const workspacePaths = new Map<string, { name: string; version: string }>();
  for (const workspace of graph.packages) {
    const relative = path.relative(normalizedRoot, workspace.root);
    if (!relativePath(relative) || relative.split("/").includes("node_modules")) {
      throw new Error("Unsafe locked workspace path");
    }
    checkManifest(workspace.manifest, record(packages[relative], `workspace ${relative}`), `workspace ${relative}`);
    roots.add(workspace.root);
    workspacePaths.set(relative, { name: workspace.name, version: workspace.version });
  }

  const groups = new Map([...roots].map(packageRoot => [packageRoot, new Map<string, ResolvedDependency>()]));
  const links: NpmLockPlan["links"] = [];
  const bundled: NpmLockPlan["bundled"] = [];
  const archived = new Set<string>();
  const installedRecords = new Map<string, RecordValue>();
  const consumers = new Map<string, RecordValue>([[normalizedRoot, manifest]]);
  for (const workspace of graph.packages) consumers.set(workspace.root, workspace.manifest);
  for (const [key, raw] of Object.entries(packages)) {
    if (key === "" || workspacePaths.has(key)) continue;
    if (!relativePath(key)) throw new Error("Unsafe package-lock installation path");
    const entry = record(raw, `package ${key}`);
    const segments = key.split("/");
    const firstModules = segments.indexOf("node_modules");
    if (firstModules < 0) throw new Error(`Undeclared local package in lock: ${key}`);
    const packageRoot = path.join(normalizedRoot, ...segments.slice(0, firstModules));
    if (!roots.has(packageRoot)) throw new Error("Locked package lies outside declared workspaces");
    const placement = segments.slice(firstModules + 1).join("/");
    const lastName = placement.split("/node_modules/").at(-1)!;
    if (placement.split("/node_modules/").some(name => !PACKAGE_NAME.test(name))) {
      throw new Error("Invalid locked package placement");
    }
    if (entry.link === true) {
      const target = typeof entry.resolved === "string" ? workspacePaths.get(entry.resolved) : undefined;
      if (!target || target.name !== lastName) {
        throw new Error("Locked local dependency does not name a declared workspace");
      }
      links.push({ destination: path.join(normalizedRoot, key), target: path.join(normalizedRoot, entry.resolved as string) });
      installedRecords.set(path.join(normalizedRoot, key), record(packages[entry.resolved as string], "workspace target"));
      continue;
    }
    const supportedPlatform = allowsPlatform(entry.os, "linux") && allowsPlatform(entry.cpu, "wasm32");
    if (!supportedPlatform) {
      if (entry.optional === true) continue;
      throw new Error(`Required package ${lastName} does not support the browser runtime`);
    }
    if (entry.inBundle === true) {
      if (typeof entry.version !== "string" || !parseSemver(entry.version)) throw new Error("A bundled package must have a locked version");
      const directory = path.join(normalizedRoot, key);
      bundled.push({ directory, name: lastName, version: entry.version });
      installedRecords.set(directory, entry);
      consumers.set(directory, entry);
      continue;
    }
    if (typeof entry.version !== "string" || !parseSemver(entry.version) || typeof entry.resolved !== "string" ||
      typeof entry.integrity !== "string" || !/^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/u.test(entry.integrity)) {
      throw new Error(`Locked package ${lastName} requires an exact version, archive and integrity`);
    }
    const url = new URL(entry.resolved);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) {
      throw new Error("Locked archives must be credential-free HTTPS URLs");
    }
    if (entry.name !== undefined && (typeof entry.name !== "string" || !PACKAGE_NAME.test(entry.name))) {
      throw new Error("Invalid locked archive package name");
    }
    groups.get(packageRoot)!.set(placement, {
      name: lastName,
      fetchName: typeof entry.name === "string" ? entry.name : lastName,
      version: entry.version,
      tarballUrl: url.href,
      integrity: entry.integrity,
      dependencies: dependencyRecord(entry.dependencies, key),
    });
    installedRecords.set(path.join(normalizedRoot, key), entry);
    consumers.set(path.join(normalizedRoot, key), entry);
    archived.add(path.join(normalizedRoot, key));
  }
  for (const embedded of bundled) {
    let ancestor = path.dirname(embedded.directory);
    while (ancestor !== normalizedRoot && ancestor !== path.dirname(ancestor) && !archived.has(ancestor)) ancestor = path.dirname(ancestor);
    if (!archived.has(ancestor)) throw new Error("A bundled dependency must be covered by an integrity-verified parent archive");
  }
  for (const [relative, workspace] of workspacePaths) {
    const expectedLink = path.join(normalizedRoot, "node_modules", workspace.name);
    if (!links.some(link => link.destination === expectedLink && link.target === path.join(normalizedRoot, relative))) {
      throw new Error(`package-lock.json is missing workspace link ${workspace.name}`);
    }
  }
  for (const [consumerRoot, consumer] of consumers) {
    const optional = dependencyRecord(consumer.optionalDependencies, consumerRoot);
    const peers = dependencyRecord(consumer.peerDependencies, consumerRoot);
    const peerMeta = consumer.peerDependenciesMeta === undefined ? {} : record(consumer.peerDependenciesMeta, "peer dependency metadata");
    const required = {
      ...dependencyRecord(consumer.dependencies, consumerRoot),
      ...(roots.has(consumerRoot) ? dependencyRecord(consumer.devDependencies, consumerRoot) : {}),
    };
    for (const [name, spec] of Object.entries({ ...peers, ...required, ...optional })) {
      const optionalPeer = name in peers && record(peerMeta[name] ?? {}, "peer metadata").optional === true;
      const mayBeAbsent = name in optional || (optionalPeer && !(name in required));
      let cursor = consumerRoot;
      let match: RecordValue | undefined;
      let matchPath = "";
      while (true) {
        if (path.basename(cursor) !== "node_modules") {
          matchPath = path.join(cursor, "node_modules", name);
          match = installedRecords.get(matchPath);
          if (match) break;
        }
        if (cursor === normalizedRoot) break;
        const parent = path.dirname(cursor);
        if (parent === cursor || (parent !== normalizedRoot && !parent.startsWith(normalizedRoot === "/" ? "/" : normalizedRoot + "/"))) break;
        cursor = parent;
      }
      if (!match) {
        if (mayBeAbsent) continue;
        throw new Error(`package-lock.json is missing required dependency ${name} from ${consumerRoot}`);
      }
      if (spec.startsWith("file:")) {
        const link = links.find(item => item.destination === matchPath);
        if (!link || link.target !== path.resolve(consumerRoot, spec.slice(5))) {
          throw new Error(`Locked local dependency ${name} points to a different source`);
        }
      } else {
        const range = spec.startsWith("npm:") ? spec.slice(spec.lastIndexOf("@") + 1) : spec;
        if (typeof match.version !== "string" || !satisfiesRange(match.version, range)) {
          throw new Error(`Locked dependency ${name} does not satisfy ${spec}`);
        }
      }
    }
  }
  return { groups: [...groups].map(([packageRoot, tree]) => ({ root: packageRoot, tree })), links, bundled };
}
