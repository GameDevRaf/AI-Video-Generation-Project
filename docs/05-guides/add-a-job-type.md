# Guide: Add a New Job Type

Scenario: a new pipeline step — say background **music** generation (the type already exists as a stub). Follow the chain: type → handler → registration → frontend.

## 1. Declare the type

`app/types/database.types.ts` — add to the `JobType` union (for music it's already there):

```ts
export type JobType = 'script' | ... | 'music' | ...
```

The `jobs.type` DB column is plain text — no migration needed for a new type.

## 2. Write the handler — `server/worker/handlers/music.ts`

Follow the shared skeleton (see [job-handlers.md](../02-backend/job-handlers.md)):

```ts
import { getProviderKey } from '../lib/getProviderKey'
import { providerRegistry } from '../providers/registry'
import { getCatalogEntry } from '../providers/catalog'
import { updateJobStatus, storeFileOutput } from '../lib/jobs'
import type { DbJob } from '../../../app/types/database.types'

export async function handleMusicJob(job: DbJob) {
  // 1. Cast and validate input
  const input = job.input as { prompt: string; duration?: number; provider?: string; model?: string }

  // 2–3. Resolve provider + model (input → job → catalog default)
  const providerId = input.provider ?? job.provider ?? 'someprovider'
  const meta = getCatalogEntry(providerId)
  const model = input.model ?? job.model ?? meta?.defaultModel ?? 'some-default'

  // Mark slow external call
  await updateJobStatus(job.id, 'waiting_on_provider', {})

  // 4–5. Key + provider call (you'd add a MusicProvider interface + registry map, mirroring audio)
  const apiKey = await getProviderKey(meta?.keyProviderId ?? providerId, job.user_id)
  // const { audioBuffer, mimeType } = await providerRegistry.music(providerId).generate({...})

  // 6. Persist with a label that follows the conventions doc
  // await storeFileOutput(job, audioBuffer, `${job.project_id}/audio/music_${job.id}.mp3`, 'music', 'music_bed', mimeType)

  // 7. Complete
  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { provider: providerId, model },
  })
}
```

Handler rules:
- **Throw** for anything retryable/fatal — the loop handles retry (3×) and the `failed` status. Only catch things you can genuinely recover from.
- Handlers may be **re-run** on retry: make side effects safe to repeat (insert-only outputs are; a delete-then-insert like scene_split is; charging an API twice is the unavoidable cost).
- Pick output labels per [conventions.md](../04-database/conventions.md) — per-scene assets embed the scene id in the label.

## 3. Register it — `server/worker/loop.ts`

```ts
import { handleMusicJob } from './handlers/music'
const handlers: Record<JobType, (job: DbJob) => Promise<void>> = {
  // ...
  music: handleMusicJob,   // replace the "not yet implemented" stub
}
```

## 4. Frontend submission

Two established patterns — pick one:

**Single job** (one thing at a time, e.g. script/export):
```ts
const { job, isRunning, isFailed, startJob } = useJobPoller()
await startJob(projectId, 'music', { prompt, provider, model })
watch(job, j => { if (j?.status === 'completed') refetch() })
```

**Bulk per-scene jobs** (like images/videos): `jobsStore.createJob(...)` per scene + `jobsStore.startPolling(id, onDone)` + a `remaining` countdown. Copy `generateAllImages` in `ImageStage.vue`.

If the results need a read endpoint (latest-per-scene), copy `server/api/images/index.get.ts` and adjust the label prefix.

## 5. Tests

Add `tests/integration/worker/music.handler.test.ts` — copy an existing handler test; they mock `adminSupabase`, `getProviderKey`, and the provider registry, then assert status transitions and output writes.

## 6. Wire into the pipeline (optional)

If it's a new *stage* (own tab): add a `TabId` + tab entry in `StageTabs.vue`, a stage component in `app/components/stages/`, a case in the workspace page's tab rendering + `stageToTab` + a done-handler, and extend the `STAGE_ORDER` in `StageTabs.vue`. If it's an enhancement inside an existing stage (music likely belongs in Audio), just add UI to that stage component.
