# Technical Architecture Document

## 1. Purpose
This document describes the technical architecture for an AI SaaS platform that enables users to create projects and generate scripts, images, audio, video, and music through external generation providers. The system is designed as a prototype that can evolve into a production product without requiring a rewrite.

## 2. Design Goals
- Build a prototype that is easy to develop and easy to expand.
- Keep the architecture runtime-agnostic so the app can run on Bun now and Node.js later if needed.
- Support multiple generation types: script, image, audio, video, and music.
- Allow users to connect provider accounts or provide API keys.
- Support a sequential, editor-driven creation flow with timeline-based playback and revision.
- Keep external provider integration isolated from the UI.
- Use a job-based architecture so generation is asynchronous, recoverable, and scalable.

## 3. Recommended Stack
- Language: TypeScript
- Frontend: Vue
- Application Framework: Nuxt
- Runtime: Bun, written in a runtime-agnostic style so it can move to Node.js later
- Database: Supabase Postgres
- Authentication: Supabase Auth or equivalent auth layer
- Storage: Supabase Storage or compatible object storage
- Caching / Queueing: Redis later, not required for the first version

## 4. High-Level System Overview
The system is structured into four major layers:

### 4.1 Presentation Layer
The Vue/Nuxt user interface contains:
- Website home page
- Authentication pages
- Projects dashboard
- User settings
- Full creation workspace
- Export / publish pages

### 4.2 Application Layer
Nuxt server routes and application services handle:
- Authentication-aware requests
- Project creation and updates
- Job creation
- Generation orchestration
- Timeline and editor state persistence
- Provider selection and account connection flows

### 4.3 Worker Layer
A separate worker process handles long-running tasks:
- Script generation
- Scene segmentation
- Image prompt generation
- Image generation
- Audio generation
- Video generation
- Music generation
- Export preparation
- Publishing tasks

### 4.4 Data Layer
Supabase stores:
- Users and profiles
- Projects
- Generation jobs
- Job outputs and artifacts
- Provider credentials and connected accounts
- User preferences and settings

## 5. Core Architecture Principle
The app should be job-driven rather than request-driven.

A user action creates a job. The worker executes the job asynchronously. Outputs are stored in the database and/or storage. The frontend polls or subscribes to job state updates.

This pattern is essential because generation tasks can take seconds or minutes and may need retries, partial progress, or step-by-step editing.

## 6. Runtime-Agnostic Strategy
The codebase should avoid Bun-specific APIs in core business logic.

### Recommended rules
- Use standard TypeScript and platform-neutral libraries where possible.
- Keep request handling inside Nuxt server routes or service modules.
- Isolate runtime-specific code behind adapters.
- Avoid direct dependence on `Bun.*` APIs in generation logic.
- Keep the worker implementation portable so the same code can run under Bun or Node.js.

### Example portability boundaries
- Safe: `fetch`, JSON, database queries, typed domain services
- Isolated: file system access, process management, browser automation, queue adapters

## 7. Main Application Modules

### 7.1 Authentication Module
Handles:
- Sign up
- Login
- Session management
- Account linking
- Profile creation

### 7.2 Project Module
Handles:
- Project creation
- Project overview
- Project metadata
- Project ownership
- Project status tracking

### 7.3 Script Module
Handles:
- Script idea intake
- Tone selection
- Multiple script generation
- Script editing
- Final script locking

### 7.4 Scene Module
Handles:
- Script segmentation into scenes
- Timestamp assignment
- Scene editing
- Scene order changes
- Recalculation of downstream timestamps

### 7.5 Image Module
Handles:
- Scene image prompt generation
- Prompt editing
- Image regeneration
- Scene-image mapping
- Future support for multiple images per scene

### 7.6 Audio Module
Handles:
- Voice selection
- Voice settings
- Audio generation
- Playback with script highlighting
- Minor audio editing parameters such as pause, tone, and pronunciation

### 7.7 Video Module
Handles:
- Video prompt generation
- Scene-to-video mapping
- Duration selection based on timestamps
- Video regeneration
- Sequential timeline review and editing

### 7.8 Music Module
Handles:
- Music generation by content section
- Optional search for existing tracks
- Track-to-video alignment
- Volume controls globally and locally
- Final preview with audio mix

### 7.9 Export / Publish Module
Handles:
- Final video assembly
- Video export as MP4 or other formats
- Publishing to connected YouTube accounts
- Export history and status

### 7.10 Provider Integration Module
Handles:
- API key storage and validation
- Connected account linking
- Provider selection per generation type
- Web automation or browser-based account usage where applicable

## 8. Generation Workflow Architecture
The app should support the following pipeline:

1. User logs in.
2. User creates a project.
3. User provides a script idea and tone.
4. System generates multiple scripts.
5. User selects and edits one script.
6. System splits the script into scenes with timestamps.
7. User edits scene boundaries.
8. System recalculates timestamps.
9. User starts image generation.
10. System generates prompts for each scene image.
11. User edits prompts or generates images first depending on the user setting.
12. User selects voice settings.
13. System generates audio.
14. User reviews audio with script highlighting and image playback.
15. User edits small audio details or changes the voice.
16. User starts video generation.
17. System generates prompts per video segment.
18. System combines image, prompt, and timestamps to create videos.
19. User reviews each video segment on the timeline.
20. User edits prompts or regenerates selected clips.
21. User starts music generation if needed.
22. System generates or sources tracks based on segment length and tone.
23. User reviews the full video with music mix controls.
24. User previews the final result.
25. User exports or publishes the video.

## 9. UI Architecture

### 9.1 Global UI Concepts
- A top-right model selector for each generation stage.
- A thin, minimal bottom timeline for playback.
- An expandable timeline for selecting a specific video or music segment.
- A pop-up panel for API keys and connected provider accounts.
- A seamless scroll-based transition from script generation through music generation.

### 9.2 Pages
- Website Home Page
- User Dashboard / Projects Page
- User Settings Page
- Script Generation Page
- Image Generation Page
- Audio Generation Page
- Video Generation Page
- Music Generation Page
- Export / Publish Page

### 9.3 UX Behavior
- The creation flow should feel like one continuous workspace.
- Each generation stage should preserve context from the previous stage.
- Editing should be local to the current stage but automatically propagate when required.
- Playback controls should stay consistent across media types.

## 10. Worker Architecture
The worker service should process queued jobs in stages.

### Worker responsibilities
- Claim queued jobs safely.
- Execute provider requests.
- Retry failed steps.
- Store outputs and metadata.
- Update job state.
- Support partial progress and step checkpoints.

### Suggested internal stages
- queued
- processing
- waiting_on_provider
- rendering
- uploading
- completed
- failed

## 11. Data Flow Summary
1. User action enters Nuxt UI.
2. Nuxt server routes validate the request.
3. A job record is created in the database.
4. The worker claims the job.
5. The worker calls the generation provider.
6. Outputs are stored.
7. Job state is updated.
8. The UI reflects progress and results.

## 12. Extensibility Notes
The system is designed so that future upgrades can be added without a rewrite:
- Redis-backed queues can replace DB polling later.
- Multiple workers can run in parallel.
- More providers can be added per generation type.
- A multiple-image-per-scene model can be added later.
- Publishing targets can be expanded beyond YouTube.
- Teams and collaboration features can be added later.

## 13. Recommended Implementation Order
1. Authentication and user settings.
2. Project creation and dashboard.
3. Script generation and editor.
4. Scene segmentation and timestamp editing.
5. Image generation.
6. Audio generation.
7. Video generation.
8. Music generation.
9. Export and publish.
10. Queue optimization and Redis.

## 14. Summary
The best architecture for this product is a Nuxt-based full-stack application with TypeScript, Supabase, and a portable worker service. The application should be centered on jobs, scenes, and outputs, with provider integrations isolated behind service layers. Bun can be used as the runtime, but the code should remain portable so the runtime can change later if necessary.

