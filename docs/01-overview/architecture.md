# Architecture

## What the app does

A user types a video idea. The app generates a voiceover **script** (LLM), splits it into **scenes**, generates an **image prompt** and **image** per scene, a **voiceover** per scene (TTS), a **motion prompt** and **video clip** per scene (image-to-video AI), and finally **exports** everything as one MP4 with ffmpeg. Output format is fixed: vertical 9:16, max 180 seconds (`shared/config/videoFormat.ts`).

> Prefer pictures? [diagrams.md](diagrams.md) has rendered Mermaid flowcharts of everything below — a system overview, a detailed module map, and the user flow.

## The three moving parts

```
┌────────────────┐  HTTP ($fetch)   ┌──────────────────┐   poll every 3s   ┌──────────────────┐
│  Browser (Vue) │ ───────────────► │  Nuxt server      │                   │  Worker process   │
│  app/          │ ◄─────────────── │  server/api/      │                   │  server/worker/   │
└────────────────┘                  └────────┬─────────┘                   └────────┬─────────┘
                                             │ writes jobs                          │ claims jobs,
                                             │ (user-scoped client, RLS)            │ calls AI providers
                                             ▼                                      ▼ (admin client)
                                    ┌──────────────────────────────────────────────────┐
                                    │  Supabase: Postgres (jobs, scenes, outputs…)     │
                                    │  + Auth (email/password) + Storage (assets bucket)│
                                    └──────────────────────────────────────────────────┘
```

1. **Frontend** (`app/`) — Vue components. Submits jobs via `POST /api/jobs`, then *polls* `GET /api/jobs/:id` every 2 s until the job completes, then fetches the produced asset URLs.
2. **API routes** (`server/api/`) — thin HTTP layer. Auth-check → ownership-check → read/write DB → return JSON. No AI calls, no slow work.
3. **Worker** (`server/worker/`) — infinite loop that claims queued jobs from the `jobs` table and runs the matching **handler**, which calls an external AI **provider** and stores results.

They never call each other directly — the database is the only communication channel. This is the same shape as a Python web app + Celery, except the queue is a Postgres table instead of Redis.

## The job queue pattern (heart of the system)

Every AI operation is a **job row** in the `jobs` table:

```
type:     'script' | 'scene_split' | 'image_prompt' | 'image' | 'audio' | 'video_prompt' | 'video' | 'export'  (+ 'music', 'publish' — not implemented)
status:   queued → processing → (waiting_on_provider) → completed | failed | retrying
input:    JSON — job-type-specific parameters (e.g. { idea, tone } for script)
provider: which AI service to use (e.g. 'anthropic', 'runway')
model:    which model at that provider
```

Lifecycle:

1. Frontend `POST /api/jobs` inserts the row with `status: 'queued'`. (The route **de-duplicates**: an identical queued/processing job for the same project/type/scene is returned instead of creating a duplicate — protects against double-clicks wasting credits.)
2. Worker's loop (`server/worker/loop.ts`) polls every 3 s, claims the oldest queued/retrying job by atomically flipping it to `processing`.
3. The matching handler in `server/worker/handlers/` runs. Handlers that call slow providers first set status `waiting_on_provider`.
4. Results are written to the **`job_outputs`** table — text outputs go into `metadata.content`; binary files (images/audio/video) are uploaded to the Supabase Storage `assets` bucket and referenced by `storage_url`.
5. Status → `completed` (with an `output_summary`), or on a thrown error → `retrying` (up to **3 retries**), then `failed` with `error_message`.
6. Frontend polling sees the terminal status and refreshes its data.

## The pipeline stages

A project moves through stages, recorded in `projects.current_stage`:

```
script → scene_split → image → audio → video → export
```

The UI (workspace page) shows four tabs — Script, Image, Audio, Video — and unlocks each tab once the project reaches that stage. Scene-splitting lives inside the Script tab; Export appears inside the Video tab. Each stage's "Continue →" button advances `current_stage` via the project store.

Per stage, what happens (details in [job-handlers.md](../02-backend/job-handlers.md)):

| Stage | Jobs involved | Produces |
|---|---|---|
| Script | `script` | 3 script candidates (or 1 refinement) as text outputs |
| Scene split | `scene_split` | Rows in the `scenes` table with per-scene text + estimated durations |
| Image | `image_prompt`, then `image` (one per scene) | Text prompts, then image files per scene |
| Audio | `audio` (one per scene), then `POST /api/audio/combine` | Per-scene MP3s, then one concatenated `voice_track` |
| Video | `video_prompt`, then `video` (one per scene) | Motion prompts, then video clips per scene (image-to-video, seeded by the scene image) |
| Export | `export` | Final MP4 in storage + a row in `exports` + JSON manifest |

**"Latest wins" convention:** regeneration never overwrites — it inserts a *new* `job_outputs` row with the same `label` (e.g. `scene_image_<sceneId>`). Every reader sorts by `created_at DESC` and takes the newest per scene. See [conventions.md](../04-database/conventions.md).

**Skip Video Gen:** a per-project toggle (`project_settings.skip_video_gen`). When on, the export builds a slideshow by holding each scene's *image* for the scene's duration instead of using generated video clips.

## Providers: one interface per media category

Each external AI service is wrapped in an **adapter class** implementing a small interface (`ScriptProvider`, `ImageProvider`, `AudioProvider`, `VideoProvider` — see `server/worker/providers/types.ts`). Handlers never know provider specifics; they call `providerRegistry.image('fal').generate({...})`.

Two sources of truth:

- `server/worker/providers/catalog.ts` — **metadata** for the UI: display names, model lists, which providers share an API key (`keyProviderId`, e.g. Veo/Nano Banana/Gemini TTS all use the `gemini` key). Re-exported to the frontend via `app/utils/providerCatalog.ts`.
- `server/worker/providers/registry.ts` — **implementation** map: provider id → adapter instance.

Adding a provider touches catalog + adapter + registry. Guide: [add-a-provider.md](../05-guides/add-a-provider.md).

## Authentication & security model

- **Supabase email/password auth.** Session lives in cookies; the browser client and the server share it.
- API routes call `serverSupabaseUser(event)` — returns the user or `null` (routes then throw 401). Then they use the **user-scoped client**, so Postgres RLS policies enforce row ownership even if route code forgets a check (most routes *also* explicitly verify project ownership — defense in depth).
- The worker uses the **service-role client** (`adminSupabase`) which bypasses RLS — safe because jobs already carry a verified `user_id`/`project_id` from creation time.
- Users' AI provider keys are stored **AES-256-GCM encrypted** in `api_keys`; the encryption key is derived from `SUPABASE_SERVICE_ROLE_KEY`. Secrets are only ever decrypted inside the worker; API routes never return them.

## Key configuration files

| File | Purpose |
|---|---|
| `nuxt.config.ts` | Nuxt modules (Supabase, Pinia, VueUse), Tailwind, auth redirect rules, and the `#supabase/server` alias pointing to the project-local `supabase-server.ts` (overrides the Supabase module's default server helpers) |
| `tsconfig.json` | TypeScript strictness — notably `noUncheckedIndexedAccess` |
| `vitest.config.ts` | Test environments per folder (node vs nuxt) and coverage scope |
| `playwright.config.ts` | E2E test browser config |
| `shared/config/videoFormat.ts` | The single hardcoded output format (9:16, 180 s max) |

> ⚠️ **Known format inconsistency:** `VIDEO_FORMAT` declares 9:16 · 1080×1920, and image/video *providers* request vertical output — but the export pipeline's ffmpeg normalization (`server/worker/handlers/export.ts`) currently scales/pads everything to **1280×720 (16:9 landscape)**. If you touch export or resolution logic, be aware these disagree today.
