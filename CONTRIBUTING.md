# Contributing

## Development setup

1. Install Node.js 22 and ffmpeg/ffprobe.
2. Copy `.env.example` to `.env` and fill in the Supabase values.
3. Run the numbered SQL migrations in `supabase/migrations/`.
4. Install dependencies with `npm ci`.
5. Start the app and worker in separate terminals:

   ```bash
   npm run dev
   npm run worker:watch
   ```

The documentation site has its own dependencies:

```bash
cd docs-site
npm ci
npm run dev
```

## Before opening a pull request

Run the relevant checks:

```bash
npm run test
npx nuxi typecheck
npm run build
cd docs-site && npm run check
```

Changes to API behavior, worker behavior, providers, database migrations, or
the frontend workflow should update the corresponding page in `docs-site/`.
Do not commit `.env`, provider credentials, generated media, Playwright
artifacts, or local history backup bundles.

Repository automation and AI-agent notes are intentionally kept out of the
public tree. Contributors do not need an MCP server to build or test the app;
the local docs site is the source of truth for project architecture and
workflows.
