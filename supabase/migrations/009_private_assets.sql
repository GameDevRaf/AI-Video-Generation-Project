-- ============================================================
-- 009 — Make generated assets private
-- ============================================================

-- Migration 005 created this bucket before private delivery was required.
-- Keep this migration so existing projects are upgraded as well as fresh ones.
update storage.buckets
set public = false
where id = 'assets';

alter table public.exports
  add column if not exists storage_path text;

-- Backfill paths for exports created before this migration. The related
-- job_outputs row is the durable source of truth for generated exports.
update public.exports e
set storage_path = o.storage_path,
    storage_url = null
from public.job_outputs o
where o.job_id = e.job_id
  and o.label = 'final_export_mp4'
  and o.storage_path is not null
  and e.storage_path is null;

-- Clear every legacy URL, including rows whose path cannot be recovered. Those
-- assets must be regenerated or re-uploaded after the bucket becomes private.
update public.job_outputs
set storage_url = null;

-- Public URLs are not a fallback for exports that could not be backfilled.
-- Such an export must be regenerated rather than left publicly readable.
update public.exports
set storage_url = null;
