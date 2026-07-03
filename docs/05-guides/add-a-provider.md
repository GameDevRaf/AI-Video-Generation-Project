# Guide: Add a New Provider

Scenario: you want to offer a new AI service — say a new image API called "Acme Images". Four files, in this order.

## 1. Catalog entry — `server/worker/providers/catalog.ts`

Add to `PROVIDER_CATALOG` under the right category section:

```ts
{
  id: 'acme_image',                 // unique, snake_case; becomes the registry key & DB value
  displayName: 'Acme Images',
  category: 'image',
  defaultModel: 'acme-v1',
  asyncPattern: 'sync',             // 'sync' | 'polling' | 'queue' — documents the API style
  models: [
    { id: 'acme-v1', label: 'Acme v1' },
    { id: 'acme-v1-fast', label: 'Acme v1 Fast' },
  ],
  // Only if it authenticates with another provider's key:
  // keyProviderId: 'acme',
  // Only if it needs two secrets (they'll be stored as one JSON string):
  // dualCredentials: true, dualCredentialFields: ['API Key', 'Workspace ID'],
},
```

That alone makes it appear in the ModelSelector dropdown and Settings — the UI is fully catalog-driven.

## 2. Adapter — `server/worker/providers/image/acme_image.ts`

Implement the category's interface from `../types`:

```ts
import type { ImageProvider, ImageParams, ImageResult } from '../types'

export class AcmeImageProvider implements ImageProvider {
  readonly providerId = 'acme_image'

  async generate(params: ImageParams): Promise<ImageResult> {
    // Build the client/request PER CALL with params.apiKey — never module-global.
    const res = await fetch('https://api.acme.dev/v1/images', {
      method: 'POST',
      headers: { Authorization: `Bearer ${params.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: params.model,
        prompt: params.prompt,
        // Hardcode the provider's closest vertical/9:16 preset (see VIDEO_FORMAT):
        aspect_ratio: '9:16',
      }),
    })
    if (!res.ok) throw new Error(`Acme error ${res.status}: ${await res.text()}`)
    const data = await res.json() as { url?: string }
    if (!data.url) throw new Error('Acme returned no image URL')
    return { imageUrl: data.url }        // or { rawBuffer, mimeType } if the API returns bytes
  }
}
```

Rules (see [providers.md](../02-backend/providers.md) for why):
- **Throw** descriptive errors — the queue converts them to retries/failure messages users see.
- If the API is async (create-task-then-poll), poll **inside** `generate()` with a sane timeout (copy `video/runway.ts`).
- Category result contracts: image/video → URL *or* rawBuffer; audio → always `{ audioBuffer, mimeType }`; script → `{ text }`.
- Prefer an official npm SDK if one exists (add it to `package.json` via `npm install <pkg>`); plain `fetch` is fine too.

## 3. Registry — `server/worker/providers/registry.ts`

```ts
import { AcmeImageProvider } from './image/acme_image'
// ...
const imageProviders: Record<string, ImageProvider> = {
  // ...
  acme_image: new AcmeImageProvider(),
}
```

The key **must** equal the catalog `id`.

## 4. Unit test — `tests/unit/providers/acme.image.test.ts`

Copy the closest existing test (e.g. `fal.image.test.ts` or `stability.image.test.ts`); they mock the HTTP layer/SDK and assert: correct request contents (model, prompt, auth header), correct result mapping, and that errors throw. Run:

```bash
npm run test:unit
npx nuxi typecheck
```

## Done — what you get for free

- ModelSelector shows it with a "key needed" badge; the inline paste-key form stores the key encrypted (under `keyProviderId` if set).
- Handlers pick it up automatically once selected (they resolve provider → registry).
- Job errors (bad key, API failure) surface in the stage UI with your thrown messages.

## Checklist for special cases

- **Shared key** (same vendor as an existing provider): set `keyProviderId`; do *not* create a second key entry flow.
- **Two credentials**: set `dualCredentials` + labels; in the adapter, `JSON.parse(params.apiKey)` (copy `video/kling.ts` / `audio/playht.ts`).
- **Audio provider with selectable voices**: the voice picker UI only exists for ElevenLabs/OpenAI TTS (`useAudioStage.VOICES`); for others add a default voice in `DEFAULT_VOICES` in `server/worker/handlers/audio.ts`.
- Update the provider inventory table in [providers.md](../02-backend/providers.md).
