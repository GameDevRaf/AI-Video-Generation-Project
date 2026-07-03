# Data Flow Walkthrough

This traces **one real user action through every layer**: the user clicks "Generate scripts" in a fresh project. If you understand this walkthrough, you understand 80% of the codebase — every other stage (images, audio, video) follows the same pattern with different job types.

## Cast of files

```
app/components/stages/ScriptStage.vue     the button lives here
app/composables/useJobPoller.ts           submits the job + polls it
server/api/jobs/index.post.ts             creates the job row
server/worker/loop.ts                     claims the job
server/worker/handlers/script.ts          does the actual work
server/worker/providers/script/anthropic.ts  talks to the Claude API
server/worker/lib/jobs.ts                 writes results
server/api/jobs/[id].get.ts               polling endpoint
```

## Step 1 — The click (browser)

`ScriptStage.vue` has the form state (`idea`, `tone`) and the target length. Its `generate()` reads the project's preferred provider/model from the **project store** and calls the composable:

```ts
await startJob(props.projectId, 'script', {
  idea: idea.value.trim(),
  tone: tone.value,
  target_duration_seconds: targetDuration.value,
  provider,   // e.g. 'anthropic' — only included if the project has a preference
  model,      // e.g. 'claude-sonnet-4-6'
})
```

## Step 2 — Job submission (browser → API)

`useJobPoller.startJob()` guards against double-clicks (`starting || polling` → return), then:

```ts
const created = await $fetch('/api/jobs', { method: 'POST', body: { projectId, type, input } })
```

and starts a 2-second polling interval (`useIntervalFn` from VueUse).

## Step 3 — The API route (server)

`server/api/jobs/index.post.ts`, in order:

1. `serverSupabaseUser(event)` — reads the auth cookie; `null` → **401**.
2. Validates `projectId` and `type` are present → else **400**.
3. Ownership check: selects the project `WHERE id = projectId AND user_id = user.id` → no row → **403**.
4. **Deduplication**: if a job with the same project/type (and same `input.scene_id`, or both null) is already `queued`/`processing`, returns that existing job — no new row. This is why double-submits don't burn API credits.
5. Inserts the job row: `status: 'queued'`, plus `input`, `provider`, `model`. Returns it as JSON.

Note this route uses the **user-scoped** Supabase client, so RLS would block writing a job for someone else's project even if the explicit check were removed.

## Step 4 — The worker claims it

Meanwhile the worker (`loop.ts`) has been ticking every 3 seconds:

1. `claimNextJob()` selects the **oldest** job with status `queued` or `retrying`, then atomically updates it to `processing` *with a conditional* `WHERE status IN ('queued','retrying')` — so if another worker process grabbed it first, the update matches zero rows and this worker gets `null`.
2. `processJob()` looks up the handler by `job.type` in the `handlers` map → `handleScriptJob`.

## Step 5 — The handler (the actual work)

`server/worker/handlers/script.ts` — `handleScriptJob(job)`:

1. **Resolve provider**: `input.provider` → else `job.provider` → else the user's `user_settings.default_script_provider` → else `'anthropic'`.
2. **Resolve model**: `input.model` → `job.model` → catalog default.
3. **Build the prompt.** Computes a word target from `target_duration_seconds` (`shared/utils/scriptLength.ts`, 130 words/min). Two modes:
   - fresh generation → system prompt demands **3 variations** separated by the literal delimiter `---SCRIPT_BREAK---`, spoken words only;
   - refinement (when `input.existing_script` exists) → returns 1 improved script.
4. **Get the API key**: `getProviderKey(providerId, job.user_id)` — reads the newest active row from `api_keys`, **decrypts** it (AES-256-GCM). Throws a friendly error if missing ("Add one in Settings → API Keys") — that error becomes the job's `error_message`.
5. **Call the provider**: `providerRegistry.script(providerId).generate({...})` — e.g. the Anthropic adapter calls `client.messages.create(...)` and returns `{ text }`.
6. **Store outputs**: splits on the delimiter and calls `storeTextOutput(job, text, 'script_candidate_1' … '_3')` — each inserts a `job_outputs` row with the text in `metadata.content`.
7. `updateJobStatus(job.id, 'completed', { output_summary: {...} })`.

**If any step throws** (bad key, provider outage, JSON parse error), `loop.ts` catches it: `retry_count < 3` → status `retrying` (will be re-claimed next tick); otherwise `failed` with the error message.

## Step 6 — Polling sees completion (browser)

Every 2 s the composable fetches `GET /api/jobs/:id`, which returns the job **joined with its `job_outputs`** (`select('*, job_outputs(*)')`). When status hits `completed`/`failed`, polling stops.

Back in `ScriptStage.vue`, a `computed` reads the outputs directly off the polled job:

```ts
const candidates = computed(() =>
  job.value?.job_outputs?.filter(o => o.label?.startsWith('script_candidate_')) ?? []
)
```

Vue reactivity re-renders the three candidate cards automatically — no manual "update the UI" call exists anywhere.

## Step 7 — Locking in the script

The user picks a candidate, optionally edits/refines it in `ScriptEditor.vue`, and clicks **"Use this script"**. That:

1. Saves the text in the **workspace store** (`setActiveScript`),
2. Emits `done` up to the workspace page, which calls `projectStore.setStage('scene_split')` — writing `projects.current_stage` via `PATCH /api/projects/:id`,
3. `SceneSplitStage` becomes visible; its "Split into scenes" button starts a `scene_split` job — whose input `{ script_text }` incidentally becomes the **persistent record of the final script** (that's what `GET /api/script` reads back when you reopen the project).

## How the other stages differ

Same skeleton, different specifics:

| Stage | Fan-out | Result storage |
|---|---|---|
| `scene_split` | one job | writes **rows in `scenes`** (deletes + replaces all), not job_outputs |
| `image_prompt` / `video_prompt` | one job covers all scenes (or one with `input.scene_id`) | one text output per scene, label `image_prompt_scene_<id>` |
| `image` / `video` | **one job per scene**, submitted in parallel by the stage component (`jobsStore.createJob` + `startPolling` per job) | file in Storage + output labeled `scene_image_<id>` / `scene_video_<id>` |
| `audio` | one job per scene, then the frontend calls `POST /api/audio/combine` to concat into a single `voice_track` | per-scene `scene_audio_<id>` + combined `voice_track` |
| `export` | one job | downloads all latest assets, ffmpeg normalize→concat→mux, uploads `final_export_mp4`, inserts an `exports` row, marks project completed |

The **bulk generation** paths (Generate all images/videos) use the `jobs` store instead of `useJobPoller` because they track *many* jobs at once: each job gets its own poller and a countdown (`remaining`) flips the button back when the last one settles.
