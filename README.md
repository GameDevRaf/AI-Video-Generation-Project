# AI Video Generation Project

AI Video Generation Project is a full-stack Nuxt application that turns a text idea into a short-form video:

```text
idea → script → scenes → images → voiceover → video clips → MP4 export
```

It is built as a portfolio project and demonstrates a database-backed job queue, a pluggable AI provider layer, Supabase authentication and storage, and server-side media processing with ffmpeg.

## Features

- Guided workspace for script, scene, image, audio, video, and export stages.
- Multiple interchangeable providers for text, image, audio, and video generation.
- Bring-your-own provider API keys, encrypted at rest on the server.
- Background worker for slow provider calls and polling jobs.
- Scene uploads, regeneration, retry handling, and latest-output selection.
- Private Supabase Storage assets served through one-hour signed URLs.
- Vertical 9:16 MP4 export with optional images-only mode.

## Architecture

The browser talks to the Nuxt server through authenticated API routes. The server writes user-scoped jobs to Supabase. A separate worker claims jobs, calls the selected provider, stores outputs, and updates job status. ffmpeg combines the final media into a downloadable MP4.

```text
Vue app → Nuxt API → Supabase jobs table → worker → AI provider
                                      ↘ Supabase Storage
```

The application source is in `app/`, API and worker code is in `server/`, shared types and configuration are in `shared/`, database migrations are in `supabase/`, and the maintained developer documentation is in `docs-site/`.

## Demo

There is no hosted deployment URL yet. Run the local setup below to explore the complete flow in a real Supabase project. The repository intentionally does not include generated screenshots or media artifacts; add fresh captures from your own run if you publish a portfolio showcase.

## Quick start

### Prerequisites

- Node.js 22 (Node 20+ is supported)
- npm
- ffmpeg and ffprobe on your PATH
- A Supabase project with email authentication enabled

### Install and configure

```bash
npm ci
copy .env.example .env
```

Fill in the Supabase values and generate a unique `API_KEY_ENCRYPTION_SECRET` of at least 32 characters. Never commit `.env`, service-role keys, or provider keys.

Run the migrations in `supabase/migrations/` in numeric order, from `001` through `009`, in the Supabase SQL editor.

### Run the app

Use two terminals:

```bash
npm run dev
npm run worker:watch
```

Open `http://localhost:3000`, create an account, create a project, add a provider key, and work through the stages.

The documentation site runs separately:

```bash
cd docs-site
npm ci
npm run dev
```

Open `http://localhost:3001` for the developer documentation.

## Provider keys and costs

Users supply their own provider credentials. Keys are encrypted before they are stored and are only decrypted inside the worker. Provider calls can incur charges, quotas, or usage limits according to each provider's terms. This project does not provide a shared API budget.

Changing `API_KEY_ENCRYPTION_SECRET` intentionally invalidates previously stored provider keys; users must enter them again.

## Development commands

```bash
npm run test
npm run test:unit
npm run test:integration
npm run test:database       # requires Supabase integration credentials
npx nuxi typecheck
npm run build
cd docs-site && npm run check
```

The browser E2E suite requires a configured Supabase project and a running app. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and the [testing guide](docs-site/content/6.testing/1.testing.md) for details.

## Known limitations

- Provider availability and model behavior vary over time.
- Generation is limited by provider quotas and can take several minutes.
- The worker runs separately from the web process in development and production deployments.
- This repository is a portfolio project, not a hosted production service or support commitment.

## License

This project is available under the [MIT License](LICENSE).
