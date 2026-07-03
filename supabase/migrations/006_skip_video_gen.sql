-- ============================================================
-- 006 — Add Skip Video Gen toggle (images-only export mode)
-- Run in Supabase SQL Editor after 005_storage_buckets.sql
-- ============================================================

ALTER TABLE public.project_settings
  ADD COLUMN IF NOT EXISTS skip_video_gen boolean NOT NULL DEFAULT false;
