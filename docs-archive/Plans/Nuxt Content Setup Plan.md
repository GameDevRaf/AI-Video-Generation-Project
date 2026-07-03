# Plan: Docus documentation site + Mermaid + MCP

## Context

The project now has a complete set of hand-written docs in `docs/` (21 Markdown files across `01-overview` … `06-testing`, plus three validated Mermaid diagrams in `docs/01-overview/diagrams.md`). The goal is to serve those docs as a polished website using **Docus** (the official Nuxt Content documentation theme), render the Mermaid flowcharts with working light/dark themes, and expose Docus's built-in **MCP server** so Claude Code can query the docs.

**Decisions confirmed with the user:**
1. **Mermaid** → use `@barzhsieh/nuxt-content-mermaid` (the maintained Nuxt Content **v3** successor). The originally-requested `@d0rich/nuxt-content-mermaid` is archived (Nov 2023) and Content **v2**-only, so it is incompatible with Docus.
2. **Placement** → the docs run as a **separate Docus app in a subfolder** (`docs-site/`) of the same repo, with its own dependencies and dev port. It is NOT merged into the main Nuxt app (Docus bundles Nuxt UI 4 + Content v3 + a catch-all route that would collide with the app's routes, `auth` middleware, Tailwind, and worker plugin).
3. **Source of truth** → the existing `docs/*.md` files are **moved into** `docs-site/content/` and adapted to Docus conventions. `docs/` as a folder goes away (single source of truth).

Outcome: `npm run dev` in `docs-site/` serves a modern docs site at `http://localhost:3001` with a sidebar, search, dark/light toggle, rendered Mermaid diagrams, and an MCP endpoint at `/mcp` that Claude Code connects to.

---

## Architecture

```
repo root/
├── app/  server/  shared/  supabase/        ← existing main app (UNCHANGED)
├── nuxt.config.ts  package.json  …          ← existing (UNCHANGED)
├── docs-site/                               ← NEW, self-contained Docus app
│   ├── content/                             ← docs live here (moved from docs/)
│   ├── public/
│   ├── app.config.ts                        ← branding, colors, nav, socials
│   ├── content.config.ts                    ← collection schema (mermaid per-page config)
│   ├── nuxt.config.ts                        ← extends Docus + mermaid module
│   ├── package.json                          ← docs-only deps, dev on :3001
│   └── assets/css/mermaid.css                ← --ncm-* variable tuning (optional)
├── docs/old/  → moved to docs-archive/ (kept, excluded from site)
└── .mcp.json                                ← NEW: registers the docs MCP server
```

The two apps share only the git repo. Main app on port 3000, docs on 3001. No shared build, no shared auth.

---

## Steps

### 1. Scaffold the Docus app
- `npx create-docus docs-site` (scaffolds Nuxt 4 + the `docus` layer + Nuxt Content v3 + Nuxt UI 4 + `better-sqlite3`). Choose npm to match the repo's `npm run` workflow.
- In `docs-site/package.json`, set the dev script to a distinct port: `"dev": "nuxi dev --port 3001"`. Keep `build`, `generate`, `preview`.
- Native dependency note: Nuxt Content v3 uses `better-sqlite3`, which compiles natively. On this Windows/Node 24 machine that may need VS Build Tools — verify `npm install` completes before proceeding.

### 2. Add the Mermaid module
- `cd docs-site && npm i -D @barzhsieh/nuxt-content-mermaid` (peer-deps `@nuxt/content >=3.5.0`, satisfied by Docus).
- Register in `docs-site/nuxt.config.ts`:
  ```ts
  export default defineNuxtConfig({
    extends: ['docus'],
    modules: ['@barzhsieh/nuxt-content-mermaid'],
    contentMermaid: {
      enabled: true,
      theme: { light: 'default', dark: 'dark' },   // auto-follows Docus color-mode
      loader: { lazy: true, init: { startOnLoad: false, securityLevel: 'strict' } },
    },
  })
  ```
- Docus ships `@nuxtjs/color-mode`, so light/dark switching of diagrams works automatically; no extra wiring. `useMermaidTheme()` is available if a manual toggle is ever wanted.
- Fenced ```mermaid blocks are transformed automatically — the existing diagrams need no syntax changes (already validated via mermaid-cli).

### 3. Migrate content into `docs-site/content/`
Move `docs/*.md` in, renaming to Nuxt Content v3 numeric-prefix convention (the `N.` prefix sets order and is stripped from the route):

| From | To | Route |
|---|---|---|
| `docs/README.md` | `content/index.md` (rewritten as a Docus hero landing page) | `/` |
| `docs/01-overview/getting-started.md` | `content/1.overview/1.getting-started.md` | `/overview/getting-started` |
| `docs/01-overview/diagrams.md` | `content/1.overview/2.diagrams.md` | `/overview/diagrams` |
| `docs/01-overview/web-dev-for-python-devs.md` | `content/1.overview/3.web-dev-for-python-devs.md` | `/overview/web-dev-for-python-devs` |
| `docs/01-overview/architecture.md` | `content/1.overview/4.architecture.md` | `/overview/architecture` |
| `docs/01-overview/folder-structure.md` | `content/1.overview/5.folder-structure.md` | `/overview/folder-structure` |
| `docs/01-overview/data-flow-walkthrough.md` | `content/1.overview/6.data-flow-walkthrough.md` | `/overview/data-flow-walkthrough` |
| `docs/02-backend/*` | `content/2.backend/{1.job-queue-and-worker,2.job-handlers,3.providers,4.api-routes,5.server-utils}.md` | `/backend/*` |
| `docs/03-frontend/*` | `content/3.frontend/{1.pages-and-routing,2.stores,3.composables,4.components}.md` | `/frontend/*` |
| `docs/04-database/*` | `content/4.database/{1.schema,2.conventions}.md` | `/database/*` |
| `docs/05-guides/*` | `content/5.guides/{1.add-a-provider,2.add-a-job-type,3.add-an-api-route,4.common-pitfalls}.md` | `/guides/*` |
| `docs/06-testing/testing.md` | `content/6.testing/1.testing.md` | `/testing/testing` |

Then:
- **Add frontmatter** (`title`, `description`) to the top of every page — Docus uses these for the sidebar label, page header, SEO, and MCP `list-pages`. Titles/descriptions can be lifted from each file's existing H1 and intro line.
- **Add `.navigation.yml`** in each section folder for the section label + icon, e.g. `content/2.backend/.navigation.yml` → `title: Backend` / `icon: i-lucide-server`. Icons: overview `i-lucide-book-open`, backend `i-lucide-server`, frontend `i-lucide-layout`, database `i-lucide-database`, guides `i-lucide-map`, testing `i-lucide-flask-conical`.
- **Rewrite internal links** with a scripted find/replace (there are dozens; do it mechanically, then verify). Transformation rules:
  - `](<../>NN-section/MM-name.md#anchor)` → `](/section/name#anchor)` (strip `../`, strip `NN-`/`MM.` prefixes, drop `.md`).
  - Same-folder `](name.md)` → `](/section/name)`.
  - `](01-overview/getting-started.md)` (index links) → `](/overview/getting-started)`.
  - Anchors (`#cryptots`) are preserved as-is.
  - Reminder note already in `diagrams.md` about keeping this a Mermaid site stays valid.
- Move `docs/old/` → `docs-archive/` at repo root (kept for history, excluded from the site). Remove the now-empty `docs/`.

### 4. Landing page (`content/index.md`)
Rewrite the old `docs/README.md` as a Docus landing page using the theme's hero/feature blocks (Nuxt UI page components Docus provides): hero title ("AI Video Generation — Docs"), short subtitle, a primary CTA to `/overview/getting-started` and a secondary to `/overview/diagrams`, and a feature grid mirroring the pipeline (Script → Image → Audio → Video → Export) and the doc sections. Keep the "who these docs are for" framing.

### 5. Branding / modern styling (`docs-site/app.config.ts`)
- Set `ui.colors.primary` and `neutral` to a palette matching the diagrams (blue/indigo primary on a slate neutral); default color mode dark (the app itself is dark-themed) but allow toggle.
- Header: site title/logo, GitHub repo link, and the section nav. Enable the right-hand table-of-contents (`aside`) and search.
- Optional `docs-site/assets/css/mermaid.css` tuning the module's `--ncm-code-bg`, `--ncm-border`, `--ncm-text`, `--ncm-overlay-bg` so the diagram container matches Docus surfaces in both themes.

### 6. MCP server for Claude Code
Docus auto-exposes an MCP server at `/mcp` (via `@nuxtjs/mcp-toolkit`) with tools `list-pages` and `get-page`. Register it project-scoped so it's shared via git — create `.mcp.json` at repo root:
```json
{
  "mcpServers": {
    "docs": { "type": "http", "url": "http://localhost:3001/mcp" }
  }
}
```
(Equivalent CLI: `claude mcp add --transport http docs http://localhost:3001/mcp`.) The docs dev server (or a deployed instance) must be running for the endpoint to respond; when deployed, swap the URL for the public docs URL. Document this in the docs-site README.

### 7. Update the main project `README.md`
Repoint the "Documentation" section from the old `docs/…` file links to: how to run the docs site (`cd docs-site && npm install && npm run dev`), the local URL, the deployed URL placeholder, and the MCP setup line.

---

## Files created / changed
- **New app**: everything under `docs-site/` (scaffolded), notably `docs-site/nuxt.config.ts`, `app.config.ts`, `content.config.ts`, `package.json`, and the migrated `docs-site/content/**`.
- **New**: `.mcp.json` (repo root), `docs-archive/` (moved from `docs/old/`).
- **Changed**: root `README.md` (doc links → docs-site run + MCP instructions).
- **Removed**: `docs/` (contents relocated).
- **Unchanged**: the entire main app (`app/`, `server/`, `shared/`, `supabase/`, root `nuxt.config.ts`, `package.json`).

## `content.config.ts` note
Extend the default collection schema with an optional passthrough `config` field so per-page Mermaid overrides (`config.theme`) are allowed in frontmatter — copy the snippet from the module's README.

---

## Verification
1. `cd docs-site && npm install` completes (watch for the `better-sqlite3` native build on Windows).
2. `npm run dev` → open `http://localhost:3001`: landing page renders; sidebar shows all six sections in order; every page opens; spot-check rewritten cross-links (Nuxt Content 404s a bad route, so broken links are visible).
3. On `/overview/diagrams`, all three Mermaid diagrams render as SVG. Toggle dark/light — diagrams re-theme and stay legible; if any `classDef`-colored nodes read poorly in light mode, adjust that diagram to lean on theme colors.
4. `npm run generate` produces static output with no build errors.
5. MCP: with the docs dev server running, `claude mcp add --transport http docs http://localhost:3001/mcp` (or the `.mcp.json` above) → `claude mcp list` shows it reachable; in a Claude Code session, `list-pages` returns the page index and `get-page /overview/architecture` returns content.
6. Main app regression check: `npm run dev` at repo root still starts on :3000 unchanged (docs are fully isolated).

## Risks / gotchas
- **`better-sqlite3` native compile** on Windows/Node 24 may need VS Build Tools — the most likely install snag.
- **Link rewriting** is the bulk of the manual work; do it by script and rely on the click-through in step 2/3 to catch misses.
- **Mermaid legibility in light mode**: current diagrams use explicit mid-tone `classDef` fills (chosen to read on both backgrounds), but verify per step 3.
- The docs site is a **second `npm install`** in the repo; note it in any CI. No workspace tooling is introduced (keeps the existing app untouched); converting to npm workspaces later remains an option.
