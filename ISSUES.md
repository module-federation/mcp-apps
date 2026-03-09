# Known Issues & Improvement Backlog

Items are ordered by priority. Each item gets a status tag.

---

## P0 · Breaks normal usage

### ① `esm.sh` silently injected into every remote's CSP
**Status:** `[x]` fixed in server.ts

`server.ts` unconditionally prepends `https://esm.sh` to every remote's
`connectDomains` and `resourceDomains`. This is a leftover from an abandoned
implementation. External users have no idea why their iframe is allowed to
connect to `esm.sh`, and it pollutes the CSP with an unintended permission.

**Fix:** Remove the `esm.sh` entries from the CSP merge in `server.ts`.

---

### ② Missing protocol in CSP domains fails silently
**Status:** `[x]` fixed in config-validator.ts — `CspDomainSchema` rejects bare hostnames at config-load time

`"localhost:3001"` (no protocol) is accepted by the config validator but
silently ignored by the browser CSP engine, causing blank component loads.
This is the #1 support question.

**Fix:** Add a `.refine()` check in `config-validator.ts` that rejects any
CSP domain that doesn't start with `http://`, `https://`, or `*`.

---

### ③ `mcp-app.html` is 686 KB transferred via MCP channel on every session
**Status:** `[ ]` reverted — shell HTML approach caused CORS issues (real origin vs `null` origin); back to single `mcp-app.html`

`resources/read` returns the entire self-contained HTML as a text field.
In HTTP mode the `/static` endpoint already serves assets — the resource
response only needs a tiny shell HTML (`<script src="/static/...">`) instead
of the full inline bundle.

**Fix:** Added `rsbuild.shell.config.ts` that builds `dist/mcp-app-shell.html`
(530 B) with assets referenced via the `__MF_MCP_BASE__` placeholder.
`CreateServerOptions.shellBaseUrl` (set by `index.ts` in HTTP mode to
`http://localhost:{port}`) causes `getMcpAppHtml` to return the placeholder-
replaced shell HTML. In stdio mode `shellBaseUrl` is `undefined` and the full
686 KB inline HTML is used as before.

---

## P1 · Common stumbling blocks in the first hour

### ④ `version` is required but meaningless for `manifestType: "mf"`
**Status:** `[x]` fixed in config-validator.ts — `version` is now optional; required only when `manifestType: "vmok"`

The schema requires `version` to be a non-empty string, but for `mf` remotes
the field is ignored entirely (the URL is always `{baseUrl}/mf-manifest.json`).
New users fill it with `"latest"` by cargo-cult, wondering if it does anything.

**Fix:** Make `version` optional when `manifestType` is `"mf"`. In the schema,
use a cross-field `refine` or a discriminated union to only require `version`
when `manifestType` is `"vmok"`.

---

### ⑤ `McpApp` TypeScript type is not exported from the package
**Status:** `[x]` fixed — `src/types.ts` created, exported via `package.json` `"./types"` entry

Component developers need the `McpApp` prop type. Currently the only way to
get it is to copy it from the docs. The package has a `"server"` exports entry
that could export it, but nothing is exported from the types side.

**Fix:** Create `src/types.ts`, export `McpApp` and `McpAppProps` interfaces,
add a `"."` or `"./types"` entry to `package.json` exports.

---

### ⑥ vmok code is interleaved with the main mf loading path
**Status:** `[x]` fixed — vmok logic extracted into `src/loaders/vmok-loader.ts`; `mf-loader.ts` dispatches to it

`mf-loader.ts` mixes vmok-specific logic (snapshot fetch, `__VMOK__` injection,
`initializeVMOK`) with the standard `mf` path. External contributors cannot
tell which code is relevant to them. vmok dependencies (`snapshot-loader.ts`)
are not usable outside ByteDance.

**Fix:** Extract vmok into its own loader strategy (`vmok-loader.ts`). The main
`loadRemoteComponent` function dispatches to `mf-loader` or `vmok-loader`
based on `manifestType`, keeping each path readable in isolation.

---

### ⑦ No dev mode — component changes require Claude Desktop restart
**Status:** `[x]` fixed — `--dev` CLI flag and `NODE_ENV=development` disable `cachedMcpAppHtml` in server.ts

`cachedMcpAppHtml` is populated once and never invalidated. After rebuilding
a component, developers must restart the MCP server (i.e., restart Claude
Desktop) to see changes.

**Fix:** Add a `--dev` / `NODE_ENV=development` flag that disables
`cachedMcpAppHtml` and re-reads the file on every `resources/read`. Also
print a clear startup message when dev mode is active.

---

## P2 · Long-term community health

### ⑧ No `npx create-mf-mcp-app` scaffold
**Status:** `[ ]` open

The demo lives inside the repo and requires cloning the whole project.
Community expects a single-command scaffold.

**Fix:** Publish a minimal `create-mf-mcp-app` CLI (or add a `--init`
flag to the existing binary) that copies `module-federation-examples/basic`
to the target directory.

---

### ⑨ Zero test coverage
**Status:** `[ ]` open

`config-validator`, `schema-converter`, and `mf-loader` have no tests.
Contributors cannot safely modify core logic.

**Fix:** Add Vitest unit tests for at minimum:
- `config-validator`: valid/invalid configs, edge cases (missing protocol, wrong snake_case, etc.)
- `schema-converter`: JSON Schema → Zod round-trip
- `loadRemoteComponent`: mock MF runtime, assert dispatch logic

---

### ⑩ No MCP Apps spec compatibility matrix
**Status:** `[x]` fixed — "Compatibility" table added to README listing spec/SDK/MF/Claude Desktop versions

`@modelcontextprotocol/ext-apps` and `@modelcontextprotocol/sdk` versions are
pinned but undocumented against the spec version they implement.

**Fix:** Add a "Compatibility" table to README listing the MCP Apps spec
version this package implements and the tested Claude Desktop version.

---

## Completed

- ① Remove `esm.sh` from CSP injection
- ② Add CSP domain protocol validation
- ③ Shell HTML reverted (CORS regression)
- ④ Make `version` optional for `manifestType: "mf"`
- ⑤ Export `McpApp` / `McpAppProps` types from package
- ⑥ Split vmok logic into `vmok-loader.ts`
- ⑦ Add `--dev` mode to disable HTML cache
- ⑩ Add compatibility table to README
