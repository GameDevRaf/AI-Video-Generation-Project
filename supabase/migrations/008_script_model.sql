-- ============================================================
-- 008 — Add missing default_script_model column
-- Run in Supabase SQL Editor after 007_target_duration.sql
--
-- Every other stage (image/audio/video) has a project_settings
-- default_*_model column; script's was never added in migration 004,
-- so the workspace page's model selector has always 500'd when saving
-- a script model choice (silently swallowed until updateSettings was
-- fixed to surface errors).
-- ============================================================

ALTER TABLE public.project_settings
  ADD COLUMN IF NOT EXISTS default_script_model text;
