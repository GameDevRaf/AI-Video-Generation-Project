# AI Video Generation Docs Site

This folder is a self-contained [Docus](https://docus.dev) app for the AI Video Generation Project documentation.

It runs separately from the main Nuxt app so the documentation theme, Nuxt Content routes, search, Mermaid diagrams, and MCP endpoint do not collide with application routes or middleware.

## Commands

```bash
npm install
npm run dev
```

The local documentation site runs at `http://localhost:3001`.

```bash
npm run generate
npm run preview
```

## MCP

Docus exposes an MCP server at `http://localhost:3001/mcp` while the docs dev server is running. The repo-level `.mcp.json` registers it as `docs`:

```bash
claude mcp add --transport http docs http://localhost:3001/mcp
```

When the docs are deployed, update `.mcp.json` to point to the public `/mcp` URL.

## Content

All maintained docs live in `content/`. Historical planning material was moved to `../docs-archive/` and is not part of the site.

Mermaid diagrams use fenced `mermaid` blocks and are rendered by `@barzhsieh/nuxt-content-mermaid`.
