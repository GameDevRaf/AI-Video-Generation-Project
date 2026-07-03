# AGENTS.md

Project-wide guidance for AI coding agents working in this repository.

## Project

AI Video Generation Project is a Nuxt 4 full-stack app for turning a text idea into a short-form video: script -> scenes -> images -> voiceover -> video clips -> final MP4.

Stack: Nuxt 4, Vue 3, TypeScript, Pinia, Tailwind v4, Supabase, ffmpeg, Vitest, Playwright.

## Documentation First

- Use the Docus MCP server `docs` first for internal project docs: call `list-pages`, then `get-page` for relevant pages.
- If the MCP server is unavailable, read the fallback Markdown files in `docs-site/content/**`.
- For external framework, library, SDK, API, CLI, or cloud-service docs, use Context7 before relying on memory.
- Before editing docs, read `/guides/documentation`. Before editing diagrams, read `/guides/diagrams`.

## Required Workflow

1. Read the relevant internal docs and external docs for the task.
2. Implement the feature or bug fix.
3. Add, adjust, or remove tests for the change.
4. Run the relevant tests and checks.
5. Update docs in the same change:
   - Check whether normal text documentation needs updates.
   - Check whether diagrams need updates.
   - Use the relevant documentation guide before editing docs.
   - For routine docs edits, run `cd docs-site && npm run check`.
   - Run `cd docs-site && npm run generate` only occasionally for larger docs-site changes or when full static docs validation is specifically needed.
6. Ask before creating commits or pushing.

## Useful Commands

```bash
npm run dev                 # main app -> http://localhost:3000
npm run worker:watch        # background worker
npm run build               # production app build
npm run test                # all unit + integration tests
npm run test:unit           # unit tests
npm run test:integration    # integration tests
npm run test:e2e            # Playwright E2E
npx nuxi typecheck          # full Nuxt typecheck

cd docs-site && npm run dev       # docs + MCP -> http://localhost:3001
cd docs-site && npm run check     # fast docs preflight
cd docs-site && npm run generate  # build/prerender docs
```

The worker runs separately from the main dev server. Start both when testing end-to-end app behavior.

## Commits

Do not commit or push without user approval. When approved, create one concise commit containing code, tests, and docs together. Use a short subject and a concise bullet summary.
