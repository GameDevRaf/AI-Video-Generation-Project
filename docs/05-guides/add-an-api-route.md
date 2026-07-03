# Guide: Add an API Route

Scenario: you need a new endpoint, e.g. `GET /api/music?projectId=` returning the latest music track.

## 1. Pick the file path (the path IS the route)

| You want | Create |
|---|---|
| `GET /api/music` | `server/api/music/index.get.ts` (or `server/api/music.get.ts`) |
| `POST /api/music` | `server/api/music/index.post.ts` |
| `PATCH /api/music/:id` | `server/api/music/[id].patch.ts` |
| `DELETE /api/music/:id` | `server/api/music/[id].delete.ts` |

No registration step — Nuxt scans the folder.

## 2. Use the standard template

```ts
import { serverSupabaseClient, serverSupabaseUser } from '~~/supabase-server'

export default defineEventHandler(async (event) => {
  // 1. AUTH — always first
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  // 2. INPUT — query / body / path param
  const { projectId } = getQuery(event) as { projectId?: string }        // GET
  // const body = await readBody<{ projectId: string }>(event)           // POST/PATCH
  // const id = getRouterParam(event, 'id')                              // [id] routes
  if (!projectId) throw createError({ statusCode: 400, message: 'projectId is required' })

  // 3. OWNERSHIP — verify the user owns the parent project (403 phrased as not-found)
  const supabase = await serverSupabaseClient(event)
  const { data: project } = await supabase
    .from('projects').select('id')
    .eq('id', projectId).eq('user_id', user.id).single()
  if (!project) throw createError({ statusCode: 403, message: 'Project not found' })

  // 4. WORK — queries via the USER client so RLS backs you up
  const { data, error } = await supabase
    .from('job_outputs')
    .select('label, storage_url')
    .eq('project_id', projectId)
    .eq('type', 'music')
    .not('storage_url', 'is', null)
    .order('created_at', { ascending: false })   // latest-wins: newest first
  if (error) throw createError({ statusCode: 500, message: error.message })

  // 5. RETURN plain data — Nuxt serializes to JSON
  return data
})
```

`defineEventHandler`, `createError`, `readBody`, `getQuery`, `getRouterParam` are auto-imported — no import lines for them.

## 3. Rules that keep this codebase safe

1. **Auth check first, always.** Even "harmless" reads.
2. **Ownership check** for anything project-scoped. Child resources (scenes, outputs) verify through a join to `projects` — copy `scenes/[id].patch.ts`.
3. **User client by default.** Only use `adminSupabase` (from `server/worker/lib/supabase`) when RLS genuinely blocks a legitimate operation (e.g. job_outputs has no UPDATE policy) — and only *after* verifying ownership with the user client. Pattern: `image-prompts/[outputId].patch.ts`.
4. **Latest-wins reads** for job_outputs: order newest-first, dedupe per scene label ([conventions.md](../04-database/conventions.md)).
5. Keep routes **thin** — no AI calls, no long work (>a few seconds belongs in a job handler). ffmpeg in `audio/combine` is the accepted upper bound.
6. Error style: `throw createError({ statusCode, message })`. 403s say "not found" to avoid confirming existence of others' resources.

## 4. Call it from the frontend

```ts
const data = await $fetch<{ label: string; storage_url: string }[]>('/api/music', {
  query: { projectId: toValue(projectId) },
})
// POST: await $fetch('/api/music', { method: 'POST', body: {...} })
```

Wrap fetching + state in a composable if a stage owns it (copy `useImageStage.ts`).

## 5. Verify

```bash
npx nuxi typecheck     # catches wrong types end-to-end
npm run test           # if you added tests
```

Then hit it in the browser devtools Network tab or with the dev server running. Finally, document it in [api-routes.md](../02-backend/api-routes.md).
