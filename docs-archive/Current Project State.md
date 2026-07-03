# Project State — AI Video Generation Platform

> Last updated: 2026-06-23  
> Branch: `master` | 16 commits since 2026-06-20

---

## Overview

A full-stack SaaS application that turns a text description into a fully rendered MP4 video. Users move through a 7-stage pipeline: script → scenes → image prompts → images → video prompts → videos → export. Audio is generated per-scene and combined with video via ffmpeg.

**Stack:** Nuxt 4 + Vue 3 + Pinia · TypeScript (strict) · Supabase (Postgres + Storage + Auth) · Background worker job queue · 33 AI provider integrations

---

## Commit History

| Date | SHA | What was introduced |
|------|-----|---------------------|
| 2026-06-20 | `2514a55` | Initial Nuxt project scaffold, TypeScript config, dependencies |
| 2026-06-20 | `6596ca2` | Docs: Architecture, User Flow, DB Schema, Dev Plan |
| 2026-06-20 | `5d4675b` | Extended package dependencies (provider SDKs) |
| 2026-06-21 | `f85b30d` | **Upload Iteration 1** — complete core app (~17 K LOC, 104 files): all pages, components, stores, composables, API routes, worker handlers, provider adapters, DB migrations, tests |
| 2026-06-21 | `830ab3d` | Bug fix: `/api/projects` error |
| 2026-06-21 | `df6a621` | **Gen AI Tools API Integration** — 31 provider adapter files, ModelSelector UI, provider registry system (~2.4 K LOC) |
| 2026-06-21 | `6af7e17` | Stage/composable refinements, worker loop refactor |
| 2026-06-21 | `a746b08` | Minor UI and feature additions |
| 2026-06-21 | `2b48128` | AudioPlayer, MediaPreviewModal, media upload handler, export refinements, new tests (~1.6 K LOC) |
| 2026-06-21 | `0b85573` | ScriptStage/VideoStage refinements, ModelSelector enhancements, JobPoller improvements |
| 2026-06-21 | `c408db6` | **9 new providers** — Fish Audio, Gemini TTS, HF Audio/Image/Script/Video, Replicate Image/Video, Veo; 30+ new tests (~1.6 K LOC) |
| 2026-06-22 | `674d5a5` | UI polish, scene card enhancements, 293 lines of component tests |
| 2026-06-22 | `4ed62f7` | **Per-scene audio** — audio jobs fire per-scene, ffprobe duration detection, timestamp recalculation, `/api/audio/combine` endpoint |
| 2026-06-22 | `dfcb04f` | **Freeze-frame failsafe** — ffmpeg `tpad` extension when audio > video + 0.5 s; per-scene audio concat in export handler |
| 2026-06-22 | `44e72c8` | 14 integration tests for per-scene audio and export edge cases |
| 2026-06-22 | `d27f5d0` | Fix all TypeScript `noUncheckedIndexedAccess` strict-mode errors across providers and UI |

---

## The 7-Stage Pipeline

Each stage is a Vue component backed by a composable and one or more worker job types.

| # | Stage | Job Type(s) | Status |
|---|-------|-------------|--------|
| 1 | **Script Generation** | `script` | Done — multi-candidate output, inline editor |
| 2 | **Scene Splitting** | `scene_split` | Done — auto-segments script with start/end times |
| 3 | **Image Prompts** | `image_prompt` | Done — per-scene prompt refinement via LLM |
| 4 | **Image Generation** | `image` | Done — per-scene, manual override supported |
| 5 | **Video Prompts** | `video_prompt` | Done — image + script → video prompt via LLM |
| 6 | **Video Generation** | `video` | Done — per-scene MP4 from image + prompt |
| 7 | **Audio + Export** | `audio`, `export` | Done — per-scene TTS, ffmpeg mux with failsafe |

---

## AI Provider Integrations (33 Total)

### Script / LLM (7)
| Provider | Models |
|----------|--------|
| Anthropic (Claude) | Opus 4.8, Sonnet 4.6, Haiku 4.5 |
| OpenAI | GPT-4.1, GPT-4o, GPT-4.1 Mini |
| Google Gemini | 2.5 Flash, 2.5 Pro |
| Groq | Llama 3.3 70B, Llama 3.1 8B |
| Mistral | Large, Small |
| OpenRouter | Multi-model aggregator (GPT, Claude, Gemini, Llama, DeepSeek) |
| Hugging Face | DeepSeek V3, Llama 3.3 70B, Mistral 7B, Qwen 2.5 72B |

### Image Generation (8)
| Provider | Models / Notes |
|----------|---------------|
| fal.ai (FLUX) | FLUX Pro 1.1, Schnell, Dev — async queue pattern |
| OpenAI Images | GPT Image 2 |
| Stability AI | Stable Image Core, SD 3.5 Large |
| Ideogram | v3, v2 |
| Together AI | FLUX.2 Dev, FLUX.1 Schnell |
| Nano Banana (Gemini) | 3.1 Flash, Pro, 2.5 Flash — shares Gemini key |
| Replicate | FLUX Schnell, FLUX 1.1 Pro, SD 3.5 Large, Recraft v3 — polling |
| Hugging Face | FLUX.1 Schnell/Dev, SDXL, Hyper-SD |

### Audio / TTS (7)
| Provider | Models / Notes |
|----------|---------------|
| ElevenLabs | Multilingual v2, Flash v2.5, v3 |
| OpenAI TTS | TTS-1, TTS-1 HD |
| PlayHT | PlayDialog, Play 3.0 Mini — **dual credentials** (API Key + User ID) |
| Cartesia | Sonic 2, Sonic 3 |
| Fish Audio | S2 Pro (expressive), S1 (fast) |
| Gemini TTS | 2.5 Flash, 2.5 Flash Lite, 3.1 Flash — shares Gemini key |
| Hugging Face | MMS TTS (Facebook), Bark (Suno), SpeechT5 (Microsoft) |

### Video Generation (8)
| Provider | Models / Notes |
|----------|---------------|
| Runway | Gen-4 Turbo, Gen-4 — polling |
| Kling AI | v2 Master, v1 Pro, v1.5 Pro — **dual credentials** (AK + SK), polling |
| Luma (Ray-2) | Ray 2, Ray Flash 2 — polling |
| Hailuo / MiniMax | 02, 2.3 — polling |
| Pika (via fal.ai) | Pika v2.2, MiniMax Video 01 — queue-based |
| Veo (Google) | 3.1, 3.1 Fast — shares Gemini key, polling |
| Replicate | MiniMax Video 01 Live, Wan 2.1, Luma Ray 2 Flash — polling |
| Hugging Face | Wan 2.1 T2V 14B, I2VGen-XL |

**Async patterns supported:** `sync` (direct), `polling` (task-ID loop), `queue` (fal.ai async queue)  
**Key sharing:** Gemini key used by Veo, Nano Banana, Gemini TTS; HF token shared across all HF adapters  
**Dual credentials:** stored as JSON in a single encrypted `api_keys` row

---

## Backend

### Worker Job Handlers (`server/worker/handlers/`)
8 handlers, each following the same pattern: fetch job → decrypt API key → call provider → write to `job_outputs`.

- `script.ts` — script generation
- `scene_split.ts` — scene segmentation
- `image_prompt.ts` — image prompt refinement
- `image.ts` — image generation
- `audio.ts` — per-scene TTS with ffprobe duration detection
- `video_prompt.ts` — video prompt generation
- `video.ts` — video generation
- `export.ts` — ffmpeg mux (per-scene audio concat + freeze-frame failsafe)

Worker polls every 3 s, max 3 retries per job.

### API Routes (`server/api/`) — 29 Endpoints

| Area | Endpoints |
|------|-----------|
| Projects | CRUD + settings update |
| Scenes | List, update, reorder |
| Jobs | Submit, list, get by ID |
| Prompts | Image prompt list/edit, video prompt list/edit |
| Assets | Images list, videos list, audio get, audio combine |
| Provider keys | List, add/update (encrypted), delete |
| Exports | List exports |
| Settings | Get/update user settings |
| Uploads | Media upload (image/audio for scenes) |
| Script | Full project script assembled from scenes |

### Server Utilities
- `crypto.ts` — AES-256-GCM encrypt/decrypt for API keys
- `ffmpeg.ts` — ffprobe duration detection, ffmpeg mux, `tpad` freeze-frame extension
- `mediaUpload.ts` — file validation, MIME type checking, 500 MB limit

---

## Frontend

### Pages (6)
- `/` — Landing page
- `/auth/login` & `/auth/signup` — Auth forms
- `/dashboard` — Project list and creation
- `/settings` — Provider key management
- `/workspace/[projectId]` — Main workspace

### Components (19)

**Root:**
- `AudioPlayer.vue` — timeline playback with duration visualization
- `CreateProjectModal.vue` — new project dialog
- `MediaPreviewModal.vue` — asset preview modal
- `ProjectCard.vue` — dashboard card
- `SettingsProviderRow.vue` — API key management row

**Stages (10):**
`ScriptStage`, `ScriptEditor`, `SceneSplitStage`, `ImageStage`, `ImageSceneCard`, `VideoStage`, `VideoSceneCard`, `AudioStage`, `ExportStage`, `SceneCard`

**Workspace (2):**
- `ModelSelector.vue` — provider/model picker, supports dual credentials
- `ProviderPanel.vue` — inline key entry

### Composables (6)
- `useProjects.ts` — project CRUD
- `useScenes.ts` — scene list + reordering
- `useJobPoller.ts` — shared 3 s polling logic
- `useAudioStage.ts` — audio job submission + scene combining
- `useImageStage.ts` — image job submission
- `useVideoStage.ts` — video job submission

### Stores (3 — Pinia)
- `jobs.ts` — job status map, detail cache, retry/failure tracking
- `project.ts` — current project, scenes, settings, draft state
- `workspace.ts` — active stage, tab state, modals

---

## Database (Supabase)

### Tables (10)
| Table | Purpose |
|-------|---------|
| `users` | User profiles (auto-created on auth signup) |
| `projects` | User projects with status and current stage |
| `jobs` | Job queue (type, status, provider, model, input/output JSON, retry count) |
| `job_outputs` | Generated assets (storage URL, MIME, metadata with duration/scene_id) |
| `scenes` | Per-project scenes (title, script_text, duration, order_index, timestamps) |
| `scene_assets` | Links job outputs to scenes by role (image, audio, video, scene_audio_*) |
| `api_keys` | Encrypted provider credentials (AES-256-GCM), per user |
| `user_settings` | Per-user provider defaults and voice preference |
| `project_settings` | Per-project provider defaults, timeline density |
| `exports` | Export records (mp4, manifest, archive) |

### Migrations (5)
1. `001_initial_schema.sql` — core tables, RLS policies, auto-user trigger
2. `002_exports_table.sql` — exports table
3. `003_user_settings.sql` — user settings + auto-trigger
4. `004_provider_columns.sql` — schema adjustments
5. `005_storage_buckets.sql` — assets bucket with RLS

RLS enforced on all tables. Single `assets` storage bucket with path format `{project_id}/{type}/{filename}`.

---

## Testing (42+ Files)

### E2E (Playwright)
- Auth flow (sign-up, login, session)
- Navigation (dashboard, workspace)
- API auth guards
- ModelSelector interaction

### Integration (Vitest)
- `script.handler` — script generation with mocked providers
- `image.handler` — image generation with fallback logic
- `image-prompt.handler` — prompt refinement
- `video.handler` — video generation with duration
- `video-prompt.handler` — video prompt
- `audio.handler` — per-scene audio, duration detection, DB metadata writes
- `export.handler` — per-scene audio concat, freeze-frame failsafe, fallbacks (14 test cases)

### Unit (Vitest)
- All 33 provider adapters
- 5 Vue component tests
- Utility tests: `crypto`, `script-parser`, `timestamps`, `getProviderKey`

---

## Notable Implementation Details

### Per-Scene Audio Pipeline
Audio jobs now fire once per scene (not once for the full script). After generation, ffprobe detects audio duration and writes it to `scenes.duration`. The AudioStage component calls `POST /api/audio/combine` to concatenate clips into a `voice_track`. Scene timestamps are recalculated proportionally from real audio durations. Export prefers per-scene clips over the monolithic voice_track.

### Freeze-Frame Failsafe
Export handler compares audio vs. video duration via ffprobe. When `audio_duration > video_duration + 0.5s`, it applies `ffmpeg tpad=stop_mode=clone` to hold the last frame, ensuring the audio is never cut off.

### Encrypted Credential Storage
All API keys are AES-256-GCM encrypted before database storage. Dual-credential providers (PlayHT, Kling) store both credentials as a JSON object in a single encrypted field.

### TypeScript Strict Mode
`noUncheckedIndexedAccess: true` is enforced project-wide. All array indexing requires either a non-null assertion after a bounds check or a `?? fallback`. This was fully resolved across all provider adapters and UI components in the final commit.

---

## Summary Stats

| Metric | Count |
|--------|-------|
| Commits | 16 |
| Source files | 121+ |
| Vue components | 19 |
| API routes | 29 |
| Worker job handlers | 8 |
| AI provider integrations | 33 |
| Database tables | 10 |
| Migrations | 5 |
| Test files | 42+ |
| Lines of code | ~17,000+ |
