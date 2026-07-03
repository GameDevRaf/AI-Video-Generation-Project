-- ============================================================
-- 007 — Add target video length (Script Length Guard + selector)
-- Run in Supabase SQL Editor after 006_skip_video_gen.sql
-- ============================================================

ALTER TABLE public.project_settings
  ADD COLUMN IF NOT EXISTS target_duration_seconds integer NOT NULL DEFAULT 180;
