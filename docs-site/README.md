# AI Video Generation Project Docs

This folder is a self-contained [Docus](https://docus.dev) app for the AI Video Generation Project documentation.

It runs separately from the main Nuxt app so the documentation theme, Nuxt Content routes, search, Mermaid diagrams, and MCP endpoint do not collide with application routes or middleware.

## Commands

```bash
npm ci
npm run check
npm run dev
```

The local documentation site runs at `http://localhost:3001`.

```bash
npm run generate
npm run preview
```

`npm run check` is the fast documentation preflight. It validates frontmatter, route collisions, route-style links, and code-fence balance without doing a full static generate.

## Optional MCP endpoint

Docus exposes an MCP server at `http://localhost:3001/mcp` while the docs dev server is running. MCP-compatible clients can connect to that endpoint when you want tool-assisted navigation of the local docs.

The endpoint is optional and is not required to build, test, or contribute to the project.

## Content

All maintained docs live in `content/`. Historical planning material is intentionally not included in the public repository.

Mermaid diagrams use fenced `mermaid` blocks and are rendered by `@barzhsieh/nuxt-content-mermaid`.
