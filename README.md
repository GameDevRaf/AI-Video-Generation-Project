# AI Video Generation Project

A full-stack **Nuxt 4** app that turns a text idea into a finished short-form video: script → scenes → images → voiceover → video clips → final MP4. All AI generation runs through a database-backed background job queue with pluggable providers (Claude, GPT, Gemini, fal.ai, Stability, ElevenLabs, Runway, Kling, Veo, and more — users bring their own API keys, stored encrypted).

**Stack:** Nuxt 4 (Vue 3 + Nitro) · TypeScript · Pinia · Tailwind v4 · Supabase (Postgres + Auth + Storage) · ffmpeg

## 📚 Documentation

Full docs live in [`docs/`](docs/README.md) — written for developers new to web dev (Python-friendly) and detailed enough for AI coding assistants:

- [Getting started](docs/01-overview/getting-started.md) · [Diagrams (flowcharts)](docs/01-overview/diagrams.md) · [Architecture](docs/01-overview/architecture.md) · [Folder structure](docs/01-overview/folder-structure.md)
- [Web dev for Python devs](docs/01-overview/web-dev-for-python-devs.md) · [Data-flow walkthrough](docs/01-overview/data-flow-walkthrough.md)
- Backend: [job queue](docs/02-backend/job-queue-and-worker.md) · [handlers](docs/02-backend/job-handlers.md) · [providers](docs/02-backend/providers.md) · [API routes](docs/02-backend/api-routes.md)
- Frontend: [pages](docs/03-frontend/pages-and-routing.md) · [stores](docs/03-frontend/stores.md) · [composables](docs/03-frontend/composables.md) · [components](docs/03-frontend/components.md)
- [Database schema](docs/04-database/schema.md) · [data conventions](docs/04-database/conventions.md) · [guides](docs/05-guides/add-a-provider.md) · [testing](docs/06-testing/testing.md)

## Quick start

Prereqs: Node 20+, ffmpeg on PATH, a Supabase project.

```bash
npm install
```

1. Create `.env` with your Supabase credentials — see [getting-started.md](docs/01-overview/getting-started.md#2-environment-variables-env).
2. Run the SQL files in `supabase/migrations/` (001→008) in the Supabase SQL editor.
3. Start **both** processes:

```bash
npm run dev            # web app → http://localhost:3000
npm run worker:watch   # background job worker (separate terminal)
```

Sign up, create a project, add a provider API key when prompted, and follow the tabs: Script → Image → Audio → Video → Export.

## Commands

```bash
npm run dev / build / preview      # app
npm run worker / worker:watch      # job worker
npm run test / test:unit / test:integration / test:e2e
npx nuxi typecheck                 # full type check — run after changes
```

## Project layout (short version)

```
app/       frontend (Vue pages, components, stores, composables)
server/    API routes + background worker (handlers + AI provider adapters)
shared/    config & utils used by both sides
supabase/  database migrations
tests/     Vitest unit/integration + Playwright E2E
docs/      full documentation
```
