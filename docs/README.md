# Project Documentation

Documentation for the **AI Video Generation Project** — a Nuxt 4 full-stack app that turns a text idea into a finished short-form video (script → scenes → images → voiceover → video clips → final MP4).

These docs are written for a developer who knows **Python** (and a little C#) but is new to web development. They are also written to be complete enough that an AI coding assistant can read them and safely modify the project.

## Where to start

If you are new to the project, read in this order:

1. [Getting Started](01-overview/getting-started.md) — install, environment variables, running the app
2. [Diagrams](01-overview/diagrams.md) — three flowcharts (overview, detailed modules, user flow); the fastest way to see the shape of the system
3. [Web Dev for Python Devs](01-overview/web-dev-for-python-devs.md) — translates every web concept in this project into Python terms
4. [Architecture](01-overview/architecture.md) — the big picture: how a video gets made
5. [Folder Structure](01-overview/folder-structure.md) — what every folder and file is for
6. [Data Flow Walkthrough](01-overview/data-flow-walkthrough.md) — follows one button click through every layer of the code

Then use the reference sections as needed.

## Table of contents

### 01 — Overview
| Doc | What it covers |
|---|---|
| [getting-started.md](01-overview/getting-started.md) | Prerequisites, `.env` setup, running dev server + worker, commands |
| [diagrams.md](01-overview/diagrams.md) | Mermaid flowcharts: system overview, detailed module map, user flow |
| [web-dev-for-python-devs.md](01-overview/web-dev-for-python-devs.md) | TypeScript, async, Vue, Nuxt, SSR, npm — explained via Python analogies |
| [architecture.md](01-overview/architecture.md) | System diagram, the job queue pattern, the pipeline stages |
| [folder-structure.md](01-overview/folder-structure.md) | Macro overview of every directory |
| [data-flow-walkthrough.md](01-overview/data-flow-walkthrough.md) | One full generation traced end-to-end through the code |

### 02 — Backend (server/)
| Doc | What it covers |
|---|---|
| [job-queue-and-worker.md](02-backend/job-queue-and-worker.md) | The worker loop, job claiming, retries, `lib/` helpers |
| [job-handlers.md](02-backend/job-handlers.md) | Every handler in `server/worker/handlers/` — inputs, outputs, behavior |
| [providers.md](02-backend/providers.md) | Provider catalog, registry, adapter interfaces, per-provider notes |
| [api-routes.md](02-backend/api-routes.md) | Every HTTP endpoint — method, auth, params, body, response |
| [server-utils.md](02-backend/server-utils.md) | `crypto.ts`, `ffmpeg.ts`, `mediaUpload.ts`, `supabase-server.ts` |

### 03 — Frontend (app/)
| Doc | What it covers |
|---|---|
| [pages-and-routing.md](03-frontend/pages-and-routing.md) | Pages, layouts, middleware, how URLs map to files |
| [stores.md](03-frontend/stores.md) | The three Pinia stores and every function they expose |
| [composables.md](03-frontend/composables.md) | Every composable — inputs, returned state and functions |
| [components.md](03-frontend/components.md) | Every component — purpose, props, emits, behavior notes |

### 04 — Database
| Doc | What it covers |
|---|---|
| [schema.md](04-database/schema.md) | Every table, column, relationship, RLS policy, migration history |
| [conventions.md](04-database/conventions.md) | The `label` naming scheme, "latest wins" queries, job dedup — **read this before writing any new feature** |

### 05 — Guides
| Doc | What it covers |
|---|---|
| [add-a-provider.md](05-guides/add-a-provider.md) | Step-by-step: add a new AI provider (e.g. a new image model API) |
| [add-a-job-type.md](05-guides/add-a-job-type.md) | Step-by-step: add a new pipeline job type |
| [add-an-api-route.md](05-guides/add-an-api-route.md) | Step-by-step: add a new HTTP endpoint safely |
| [common-pitfalls.md](05-guides/common-pitfalls.md) | TypeScript strictness, import path rules, and other traps |

### 06 — Testing
| Doc | What it covers |
|---|---|
| [testing.md](06-testing/testing.md) | Test layout, how to run each suite, how to write new tests |

## Keeping these docs up to date

When you change code, update the matching doc. The rule of thumb:

- Added/changed an **API route** → update `02-backend/api-routes.md`
- Added a **provider** → update `02-backend/providers.md` (and follow `05-guides/add-a-provider.md`)
- Changed a **table** (new migration) → update `04-database/schema.md`
- Added a **component/composable/store function** → update the matching file in `03-frontend/`
- Changed a **job handler's input/output shape** → update `02-backend/job-handlers.md` and `04-database/conventions.md` if labels changed

> `docs/old/` contains pre-implementation planning documents. They are kept for history but are **not** maintained — trust the numbered folders here, not `old/`.
