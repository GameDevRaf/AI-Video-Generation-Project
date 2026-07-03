# Server Utilities

Helper modules in `server/utils/` (auto-imported inside `server/`, but the worker imports them by relative path), plus the root-level `supabase-server.ts` and the `shared/` modules.

---

## server/utils/crypto.ts

AES-256-GCM encryption for users' provider API keys. Only these two functions — used by `POST /api/provider/keys` (encrypt) and `getProviderKey` in the worker (decrypt).

### `encrypt(plaintext: string): string`
- Input: the raw API key the user pasted.
- Output: `"<iv hex>:<auth tag hex>:<ciphertext hex>"` — a self-contained string stored in `api_keys.encrypted_secret`.
- Fresh random 12-byte IV per call, so encrypting the same key twice produces different ciphertexts.

### `decrypt(stored: string): string`
- Input: the stored `iv:tag:ciphertext` string.
- Output: the original plaintext key. Throws if the string was tampered with (GCM auth tag) or the derived key changed.

### `derivedKey(): Buffer` *(internal)*
SHA-256 of `SUPABASE_SERVICE_ROLE_KEY` → the 32-byte AES key. **Consequence:** rotating the service role key breaks decryption of all previously saved provider keys (users would need to re-enter them).

---

## server/utils/ffmpeg.ts

Thin wrappers around the `ffmpeg`/`ffprobe` CLI binaries (must be on PATH). Used by the export handler, the audio handler (duration), `POST /api/audio/combine`, and uploads (video transcode).

### `runFfmpeg(args: string[]): Promise<void>`
Runs `ffmpeg -hide_banner -loglevel error <args>` via `execFile` (no shell → no injection risk). Throws `ffmpeg failed: …` on a non-zero exit. All other helpers in the codebase build their own arg arrays and call this.

### `transcodeVideoBufferToMp4(inputBuffer: Buffer, inputExtension: string): Promise<Buffer>`
Any video container → MP4 (H.264 `veryfast`, `yuv420p`, AAC audio if present, `+faststart`). Works via a temp dir that is always removed. Used on user video uploads so exports can stream-copy later.

### `downloadToFile(url: string, targetPath: string): Promise<void>`
`fetch` → write to disk. Throws on non-OK HTTP.

### `extensionFromUrl(url: string, fallback: string): string`
File extension from a URL's pathname, or the fallback (`'mp3'`, `'mp4'`, `'png'` at call sites) if the URL has none/does not parse.

### `getFileDurationSeconds(filePath: string): Promise<number>`
`ffprobe` duration of an on-disk media file. **Returns 0 on any error** (deliberately non-throwing — callers treat 0 as "unknown").

### `getBufferDurationSeconds(buffer: Buffer, ext: string): Promise<number>`
Same, for an in-memory buffer (writes a temp file first). Used by the audio handler to learn each scene's real spoken duration.

---

## server/utils/mediaUpload.ts

Validation + naming logic for `POST /api/uploads/media`, kept separate so it's unit-testable.

### `validateMediaUpload(mediaType, mimeType, filename): UploadValidationResult`
- Inputs are `unknown` on purpose (raw form fields).
- Checks `mediaType ∈ {image, audio, video}` and the mime type against `ALLOWED_MIME_TYPES` (png/jpeg/webp/gif; mp3/wav/ogg; mp4/webm/mov/avi/mkv). Throws descriptive errors that the route turns into 400s.
- Returns `{ mediaType, mimeType, extension, filename }` with a safe fallback filename.

### `getUploadLabel(mediaType, sceneId?): string`
The `job_outputs.label` an upload should get: `scene_image_<id>` / `scene_video_<id>` / `voice_track`. Keeping uploads on the same labels as generated media is what makes them interchangeable everywhere downstream.

### `getSceneAssetRole(mediaType): AssetRole`
`image → 'first_frame'`, `video → 'generated_video'` — the `role` for the `scene_assets` link row.

### `buildUploadStoragePath({ projectId, mediaType, extension, sceneId?, uniqueId }): string`
Canonical bucket path: `<projectId>/<images|videos|audio>/<sceneId|mediaType>_<uniqueId>.<ext>`.

---

## supabase-server.ts (project root)

Server-side Supabase **auth** helpers. Aliased as `#supabase/server` in `nuxt.config.ts` (Vite + Nitro + top-level alias) so it overrides the `@nuxtjs/supabase` module's own server helpers; API routes import it as `~~/supabase-server`. Exists because the app needed cookie handling the module didn't provide.

### `serverSupabaseClient(event: H3Event): Promise<SupabaseClient>`
Builds (and caches on `event.context`) a Supabase client that reads/writes the request's **auth cookies** — so all queries run *as the logged-in user* with RLS enforced. Configuration (URL, anon key, cookie options) comes from the Nuxt runtime config populated by the `NUXT_PUBLIC_SUPABASE_*` env vars.

### `serverSupabaseUser(event: H3Event): Promise<SupabaseUser | null>`
Calls `auth.getUser()` on that client.
- No/expired session (`AuthSessionMissingError`) → returns `null` **without throwing** — routes translate that into a 401.
- Other auth errors → throws 500.
- Normalizes the id (falls back to the JWT `sub` claim).

---

## shared/ (used by both browser and server)

### shared/config/videoFormat.ts
```ts
VIDEO_FORMAT = { aspectRatio: '9:16', maxDuration: 180, width: 1080, height: 1920 } as const
```
The single fixed output format. Read by: script handler (duration clamp), project settings PATCH (clamp), ScriptStage/ScriptEditor (length presets & warnings), and — as hardcoded per-provider equivalents — every image/video adapter.

### shared/utils/scriptLength.ts
Constant `WORDS_PER_MINUTE = 130` plus:

| Function | Input → Output | Used for |
|---|---|---|
| `countWords(text)` | string → word count | editor word counts, length warnings |
| `estimateSpokenSeconds(wordCount)` | count → seconds | "~42s" badges on script candidates |
| `targetWordCount(targetDurationSeconds)` | seconds → words | the word budget in generation prompts |

⚠️ Import `shared/` **by relative path only** (see [common-pitfalls.md](../05-guides/common-pitfalls.md)) — the standalone worker doesn't resolve Nuxt aliases.
