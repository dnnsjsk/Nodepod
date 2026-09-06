# nodepod

[![npm](https://img.shields.io/npm/v/@scelar/nodepod.svg)](https://www.npmjs.com/package/@scelar/nodepod)
[![CI](https://github.com/R1ck404/Nodepod/actions/workflows/ci.yml/badge.svg)](https://github.com/R1ck404/Nodepod/actions/workflows/ci.yml)

Run Node.js inside the browser. Nodepod provides a virtual filesystem, shell,
npm packages, worker-backed processes, and Node-compatible HTTP servers without
requiring an application backend.

```bash
npm install @scelar/nodepod
```

Nodepod is source-available under the MIT License with the Commons Clause. See
[License](#license) before using it in a product.

## Quick start

```ts
import { Nodepod } from '@scelar/nodepod';

const nodepod = await Nodepod.boot({
  files: {
    '/home/project/hello.js': 'console.log("Hello from the browser!")',
  },
  workdir: '/home/project',
});

const process = await nodepod.spawn('node', ['hello.js']);
process.on('output', (text) => console.log(text));
await process.completion;

nodepod.teardown();
```

The browser entry enables Nodepod's preview service worker by default. If your
product only needs files, processes, packages, or programmatic HTTP calls, use
the reduced mode:

```ts
const nodepod = await Nodepod.boot({ serviceWorker: false });
```

## Capabilities

- **Filesystem** — POSIX-style paths, files, directories, metadata, watchers,
  and serializable snapshots.
- **Shell and terminal** — a persistent shell with an optional xterm.js UI.
- **npm packages** — registry resolution, archive extraction, module transforms,
  browser-side caching, and exact npm v2/v3 lockfile installs with local workspaces.
- **Processes** — Node.js scripts and shell commands executed in Web Workers.
- **HTTP servers** — Node-compatible virtual servers reached through
  `request()`, a service-worker preview, or headless loopback ingress.
- **Headless mode** — the core runtime without terminal or preview UI in the
  browser, Node.js, and Bun.
- **Profiling and inspection** — opt-in runtime traces and attached-preview
  diagnostics.

### Locked private workspaces

Applications can keep private packages under a declared npm workspace (for
example `packages/ui`) and depend on them with `file:packages/ui`. Mount the
package source, application manifests, and the npm-generated `package-lock.json`
before running `npm ci`. No private registry is required for these directories.

For v2/v3 lockfiles, `npm ci` consumes the full locked placement graph, including
hoisted, nested, bundled, and workspace-local dependencies. It checks local
manifests before removing installed state, verifies HTTPS archives against their
locked SRI and package identity, and leaves application manifests and lockfiles
unchanged. It does not re-resolve transitive versions or install undeclared WASI
companions: browser-compatible optional packages must already be in the lock.
Unsupported required native packages fail; unsupported optional platform packages
are omitted. Registry archives without integrity, external local directories, and
undeclared workspace links are rejected. The older v1 install path is unchanged.

Workspace links retain their identity across installer, build, and preview
processes, including lean snapshots and WASI filesystem access. Removing a link
does not remove its target. This enables ordinary bundler symlink resolution and
shared peer dependencies without copying a private package into a second tree.

## Framework setup

Vite can serve and emit Nodepod's runtime assets automatically:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import nodepod from '@scelar/nodepod/vite';

export default defineConfig({ plugins: [nodepod()] });
```

Next.js, Fetch-style frameworks, Express, Fastify, bare Node servers, and static
hosts have dedicated helpers or copy-based setup. The documentation covers the
service-worker scope, preview bridge, production wildcard origins, and required
headers.

## Browser compatibility

Nodepod targets current evergreen browsers with WebAssembly and Web Workers.
Full synchronous and threaded behaviour requires cross-origin isolation and
`SharedArrayBuffer`.

Without shared memory, Nodepod supports a reduced execution path, but synchronous
child-process APIs and threaded WASI packages are unavailable. A package can also
depend on native add-ons or operating-system behaviour that browsers cannot
provide. Test the exact dependency and browser matrix your product promises.

Nodepod is not a hardened sandbox. Products that run adversarial code must define
their own trust boundary, resource limits, network policy, and cleanup strategy.

## Documentation

- [Website](https://r1ck404.github.io/Nodepod/)
- [Getting started](https://r1ck404.github.io/Nodepod/docs/)
- [Framework and preview setup](https://r1ck404.github.io/Nodepod/docs/setup/vite/)
- [Architecture](https://r1ck404.github.io/Nodepod/docs/concepts/how-nodepod-works/)
- [Security model](https://r1ck404.github.io/Nodepod/docs/concepts/security/)
- [SDK and generated API](https://r1ck404.github.io/Nodepod/docs/reference/sdk/)
- [Troubleshooting](https://r1ck404.github.io/Nodepod/docs/troubleshooting/)

The documentation website is maintained in the private `website/` workspace in
this repository. It is live at [r1ck404.github.io/Nodepod](https://r1ck404.github.io/Nodepod/).
GitHub Pages deployment is currently manual, so updates are published after
review.

## Development

Nodepod uses pnpm 10.34.5. The runtime build and tests use Node.js 20; the docs
workspace requires Node.js 22.12 or newer.

```bash
pnpm install
pnpm run type-check
pnpm run build:publish
pnpm test
```

Build the documentation locally:

```bash
pnpm run docs:build
pnpm run docs:check
pnpm run docs:test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for repository workflow and contributor
expectations.

## Sponsorship

Sponsorship will be offered through GitHub Sponsors after the profile and public
tiers are approved. Proposed details are documented on the
[sponsor page](https://r1ck404.github.io/Nodepod/sponsors/). Sponsorship will not
include an SLA, priority issue handling, private support, or early repository
access.

No private email address is published for sponsor listings.

## Links

- [npm package](https://www.npmjs.com/package/@scelar/nodepod)
- [GitHub repository](https://github.com/R1ck404/Nodepod)
- [Contributing](./CONTRIBUTING.md)
- [Sponsor policy](https://r1ck404.github.io/Nodepod/sponsors/)
- [License](./LICENSE)

## License

Nodepod is source-available under the MIT License with the Commons Clause. The
repository [LICENSE](./LICENSE) is authoritative; documentation and marketing
summaries do not replace its terms.
