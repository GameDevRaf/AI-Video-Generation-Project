# Testing

Two test systems: **Vitest** (unit + integration, like pytest) and **Playwright** (E2E browser automation).

## Commands

```bash
npm run test              # all Vitest suites (unit + integration)
npm run test:unit         # tests/unit only
npm run test:integration  # tests/integration only
npm run test:watch        # re-run on file change
npm run test:coverage     # v8 coverage (stores, composables, handlers, server utils)

npm run test:e2e          # Playwright — requires `npm run dev` running separately
npm run test:e2e:ui       # Playwright visual runner
```

Run a single file: `npx vitest run tests/unit/utils/crypto.test.ts`.

## Layout & environments

`vitest.config.ts` assigns a JS environment per folder (`environmentMatchGlobs`):

| Folder | Env | What lives there |
|---|---|---|
| `tests/unit/utils/` | node | Pure logic: crypto round-trips, script-length math, upload validation, timestamp recalculation, script parsing |
| `tests/unit/stores/` | **nuxt** | Pinia stores (need Vue auto-imports like `ref`) |
| `tests/unit/providers/` | node | Every provider adapter with SDK/HTTP mocked — one file per adapter (`<name>.<category>.test.ts`) |
| `tests/unit/components/` | (nuxt/happy-dom) | Behavior tests for tricky components (AudioPlayer, staleness dots, bulk generate) |
| `tests/integration/worker/` | node | Every job handler end-to-end with `adminSupabase`, `getProviderKey`, and providers mocked |
| `tests/e2e/` | Playwright (excluded from Vitest) | auth, navigation, model selector, API guards, happy path |

## Writing tests (patterns to copy)

**Vitest ≈ pytest**: `describe` = class/group, `it`/`test` = test function, `expect(x).toBe(y)` = assert, `vi.fn()` = MagicMock, `vi.mock('module')` = monkeypatch at import level, `beforeEach` = fixture setup.

### New provider adapter test
Copy the closest `tests/unit/providers/*.test.ts`. Skeleton:

```ts
import { describe, it, expect, vi } from 'vitest'
vi.mock('@acme/sdk', () => ({ AcmeClient: vi.fn(() => ({ images: { create: mockCreate } })) }))
import { AcmeImageProvider } from '../../../server/worker/providers/image/acme_image'

describe('AcmeImageProvider', () => {
  it('passes model, prompt and key; maps the URL', async () => { ... })
  it('throws when the API returns no image', async () => { ... })
})
```

Assert three things: request built correctly (auth, model, prompt, hardcoded aspect), result mapped correctly, failures throw.

### New handler test
Copy `tests/integration/worker/image.handler.test.ts`. They mock the three seams (`../lib/supabase`, `../lib/getProviderKey`, `../providers/registry`), build a fake `DbJob`, run the handler, and assert `updateJobStatus`/`storeFileOutput` calls and DB writes.

### Store test
Copy `tests/unit/stores/*.test.ts` — they stub `$fetch` globally (`vi.stubGlobal('$fetch', vi.fn())`) and assert state transitions, including the optimistic-update rollback in `project.updateSettings`.

## E2E notes

Playwright specs in `tests/e2e/` drive a real browser against `localhost:3000` (start the dev server first). They cover signup/login flows, route guards (unauthenticated redirects), the model selector, and a scripted happy path. Provider test keys in `.env` (`TEST_*_API_KEY`) are used by some provider tests for optional live checks — tests must still pass without them (mocked paths).

## What to test when you change something

| Change | Minimum test |
|---|---|
| Provider adapter | Unit test in `tests/unit/providers/` |
| Job handler | Integration test in `tests/integration/worker/` |
| Pure util (`server/utils/`, `shared/`) | Unit test in `tests/unit/utils/` |
| Store logic | `tests/unit/stores/` |
| API route | Currently thin coverage (`tests/integration/api/` is empty) — at minimum run the flow manually and `npx nuxi typecheck` |

Always finish with `npx nuxi typecheck` — it's the closest thing to a full-project static safety net.
