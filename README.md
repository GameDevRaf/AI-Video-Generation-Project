# AI Video Generation Project

A full-stack **Nuxt 4** app that turns a text idea into a finished short-form video: script -> scenes -> images -> voiceover -> video clips -> final MP4. All AI generation runs through a database-backed background job queue with pluggable providers including Claude, GPT, Gemini, fal.ai, Stability, ElevenLabs, Runway, Kling, Veo, and more. Users bring their own API keys, stored encrypted.

**Stack:** Nuxt 4 (Vue 3 + Nitro), TypeScript, Pinia, Tailwind v4, Supabase (Postgres + Auth + Storage), ffmpeg

## Documentation

Full docs live in the separate Docus app at [`docs-site/`](docs-site/). They are written for developers new to web dev (Python-friendly) and detailed enough for AI coding assistants.

```bash
cd docs-site
npm install
npm run dev
```

Local docs: `http://localhost:3001`

Deployed docs: _TBD_

Docus exposes an MCP server while the docs app is running. This repo includes `.mcp.json`, or you can register it manually:

```bash
claude mcp add --transport http docs http://localhost:3001/mcp
```

## Quick Start

Prereqs: Node 20+, ffmpeg on PATH, a Supabase project.

```bash
npm install
```

1. Create `.env` with your Supabase credentials. See the docs site page `/overview/getting-started#2-environment-variables-env`.
2. Run the SQL files in `supabase/migrations/` (001 -> 008) in the Supabase SQL editor.
3. Start **both** processes:

```bash
npm run dev            # web app -> http://localhost:3000
npm run worker:watch   # background job worker (separate terminal)
```

Sign up, create a project, add a provider API key when prompted, and follow the tabs: Script -> Image -> Audio -> Video -> Export.

## Commands

```bash
npm run dev / build / preview      # app
npm run worker / worker:watch      # job worker
npm run test / test:unit / test:integration / test:e2e
npx nuxi typecheck                 # full type check; run after changes
```

## Project Layout

```text
app/          frontend (Vue pages, components, stores, composables)
server/       API routes + background worker (handlers + AI provider adapters)
shared/       config and utils used by both sides
supabase/     database migrations
tests/        Vitest unit/integration + Playwright E2E
docs-site/    Docus documentation site
docs-archive/ historical planning documents
```
