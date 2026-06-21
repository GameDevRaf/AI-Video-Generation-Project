-- ============================================================
-- 004 — Add provider selection columns
-- Run in Supabase SQL Editor after 003_user_settings.sql
-- ============================================================

-- ── user_settings additions ────────────────────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS default_script_provider  text NOT NULL DEFAULT 'anthropic',
  ADD COLUMN IF NOT EXISTS default_image_provider   text NOT NULL DEFAULT 'fal',
  ADD COLUMN IF NOT EXISTS default_video_provider   text NOT NULL DEFAULT 'runway',
  ADD COLUMN IF NOT EXISTS default_audio_model      text;

-- ── project_settings additions ─────────────────────────────
-- NULL = inherit from user_settings defaults
ALTER TABLE public.project_settings
  ADD COLUMN IF NOT EXISTS default_script_provider  text,
  ADD COLUMN IF NOT EXISTS default_image_provider   text,
  ADD COLUMN IF NOT EXISTS default_audio_provider   text,
  ADD COLUMN IF NOT EXISTS default_video_provider   text;
