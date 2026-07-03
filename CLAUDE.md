# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev             # Start Nuxt dev server (localhost:3000)
npm run worker:watch    # Start background job worker with hot-reload
npm run build           # Production build
npm run preview         # Preview production build

# Testing
npm run test            # All unit + integration tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only (worker handlers)
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report (v8)
npm run test:e2e        # Playwright E2E (requires dev server)
npm run test:e2e:ui     # Playwright UI mode

# Type checking
npx nuxi typecheck      # Full project type check (both app + server)
```

The worker process must be started separately from the dev server. Both need to run simultaneously in development.

## Architecture Overview

This is a **Nuxt 4 full-stack app** where users generate AI videos through a pipeline of staged jobs. The core loop:

1. User creates a project and writes/generates a **script**
2. Script is split into **scenes**
3. Each scene gets **image prompts** → **images** → **video prompts** → **videos**
4. Audio (TTS) is generated **per-scene**, then combined into a single `voice_track`
5. Final **export** muxes all scene videos + audio via ffmpeg

### Job Queue Pattern

The entire AI generation pipeline runs through a background job queue stored in the `jobs` table. The Nuxt app submits jobs via `POST /api/jobs`; the **worker** (`server/worker/`) polls every 3s for queued jobs and dispatches them to the appropriate handler. Max 3 retries per job.

- `server/worker/loop.ts` — polling loop
- `server/worker/handlers/` — one file per job type (`script`, `scene_split`, `image_prompt`, `image`, `audio`, `video_prompt`, `video`, `export`)
- `server/worker/providers/` — provider adapters organized by category (`script/`, `image/`, `audio/`, `video/`)

Each handler follows the pattern: fetch job from DB → retrieve encrypted API key → call provider → write output to `job_outputs` table.

### Provider Catalog

`app/utils/providerCatalog.ts` is the single source of truth for all providers visible in the UI. It defines display names, categories, available models, key metadata, and which providers share a key (`keyProviderId` — e.g. Veo shares the Gemini key).

When adding a new provider: add it to the catalog, create an adapter in `server/worker/providers/<category>/`, register it in the handler's provider map.

### Database (Supabase)

Key tables:
- `jobs` — job queue (type, status, provider, model, input JSON, output JSON)
- `job_outputs` — generated assets (storage URL, mime type, metadata)
- `scenes` — scenes for a project (script_text, duration, order_index)
- `scene_assets` — links job outputs to scenes (role: `image`, `audio`, `video`, `scene_audio_*`)
- `api_keys` — encrypted provider keys (AES-256-GCM via `server/utils/crypto.ts`)
- `user_settings` / `projects` settings columns — per-user and per-project provider defaults

Migrations live in `supabase/migrations/`. Run them via the Supabase dashboard or CLI.

### Supabase Auth & SSR

`supabase-server.ts` (aliased as `#supabase/server`) provides `serverSupabaseClient` and `serverSupabaseUser`. All server API routes call `serverSupabaseUser(event)` for auth — it returns `null` on unauthenticated (no cookie) without throwing.

The alias `#supabase/server` is declared in `nuxt.config.ts` (for Vite, Nitro, and alias resolution) so it overrides the module's own default.

### TypeScript Strictness

`tsconfig` enables **`noUncheckedIndexedAccess: true`**. This means:
- `array[i]` returns `T | undefined` — use `array[i]!` after a bounds check, or `array[i] ?? fallback`
- `Record<K,V>[key]` returns `V | undefined`
- `.split(sep)[0]` returns `string | undefined` — always use `?.[0]` or `[0]!`

Run `npx nuxi typecheck` after any significant change. It checks both app and server code.

### Frontend State

- **Pinia stores** (`app/stores/`): `project` (current project data + scenes), `workspace` (UI state), `jobs` (job status map)
- **Composables** (`app/composables/`): `useScenes`, `useAudioStage`, `useImageStage`, `useVideoStage` — each owns the polling and job submission for its pipeline stage
- `useJobPoller.ts` — shared polling logic used by stage composables
- `ModelSelector.vue` — provider/model picker used in every stage; emits `providerChanged` with `(providerId, modelId)`
