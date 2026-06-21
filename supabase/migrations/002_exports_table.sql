-- ============================================================
-- 002 — Exports table
-- Run in Supabase SQL Editor after 001_initial_schema.sql
-- ============================================================

create table if not exists public.exports (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  job_id      uuid references public.jobs(id),
  export_type text not null default 'manifest',  -- manifest | mp4 | archive
  storage_url text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

alter table public.exports enable row level security;

create policy "exports: all own" on public.exports
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = exports.project_id
        and p.user_id = auth.uid()
    )
  );
