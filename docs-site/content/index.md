---
title: AI Video Generation Project Docs
description: Developer documentation for the AI Video Generation Project.
seo:
  title: AI Video Generation Project Docs
  description: Developer documentation for the AI Video Generation Project.
---

::u-page-hero
#title
AI Video Generation Project Docs

#description
Developer documentation for a Nuxt 4 app that turns a text idea into a finished short-form video: script, scenes, images, voiceover, video clips, and final MP4.

These docs are written for developers who are new to web development and detailed enough to navigate the codebase safely.

#links
  :::u-button
  ---
  color: primary
  size: xl
  to: /overview/getting-started
  trailing-icon: i-lucide-arrow-right
  ---
  Get started
  :::

  :::u-button
  ---
  color: neutral
  icon: i-lucide-git-branch
  size: xl
  to: /overview/diagrams
  variant: outline
  ---
  View diagrams
  :::
::

::u-page-section
#title
Generation pipeline

#features
  :::u-page-feature
  ---
  icon: i-lucide-scroll-text
  to: /overview/architecture
  ---
  #title
  Script

  #description
  Project prompts become structured scenes, shot descriptions, and stage-ready generation jobs.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-image
  to: /backend/job-handlers
  ---
  #title
  Image

  #description
  Scene prompts are dispatched through provider adapters and stored as reusable media assets.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-audio-lines
  to: /frontend/components
  ---
  #title
  Audio

  #description
  Voiceover jobs, polling, and media uploads connect frontend stage controls to the worker.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-film
  to: /backend/providers
  ---
  #title
  Video

  #description
  Pluggable AI providers generate clips while the database tracks status, retries, and outputs.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-package-check
  to: /overview/data-flow-walkthrough
  ---
  #title
  Export

  #description
  The final stage combines media into a deliverable MP4 and records the resulting artifact.
  :::
::

::u-page-section
#title
Documentation map

#features
  :::u-page-feature
  ---
  icon: i-lucide-book-open
  to: /overview/getting-started
  ---
  #title
  Overview

  #description
  Start here for setup, diagrams, architecture, folder structure, and an end-to-end request walkthrough.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-server
  to: /backend/job-queue-and-worker
  ---
  #title
  Backend

  #description
  Worker loop, job handlers, provider adapters, API routes, and server utilities.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-layout
  to: /frontend/pages-and-routing
  ---
  #title
  Frontend

  #description
  Pages, layouts, stores, composables, and components that power the user workflow.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-database
  to: /database/schema
  ---
  #title
  Database

  #description
  Schema, relationships, RLS policies, data conventions, and migration history.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-map
  to: /guides/add-a-provider
  ---
  #title
  Guides

  #description
  Practical recipes for extending providers, jobs, API routes, and avoiding common traps.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-flask-conical
  to: /testing/testing
  ---
  #title
  Testing

  #description
  Test layout, commands, patterns, and guidance for writing new unit, integration, and E2E tests.
  :::
::
