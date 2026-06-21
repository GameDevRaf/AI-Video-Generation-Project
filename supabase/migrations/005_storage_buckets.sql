-- ============================================================
-- 005 — Storage Buckets
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- ---- Create the single "assets" bucket ----
-- All generated files (images, audio, video) are stored here.
-- Paths follow: {project_id}/{type}/{filename}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  true,
  524288000, -- 500 MB per file
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-wav',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/matroska'
  ]
)
on conflict (id) do nothing;


-- ---- RLS policies on storage.objects ----
-- The worker uses the service_role key which bypasses RLS.
-- These policies cover authenticated users reading their own project files.

-- Allow authenticated users to read objects in their own project folders.
-- Path format: {project_id}/{type}/{filename}
create policy "assets: authenticated read own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] in (
      select id::text from public.projects where user_id = auth.uid()
    )
  );

-- Allow authenticated users to upload to their own project folders.
create policy "assets: authenticated insert own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] in (
      select id::text from public.projects where user_id = auth.uid()
    )
  );

-- Allow authenticated users to overwrite (upsert) their own files.
create policy "assets: authenticated update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] in (
      select id::text from public.projects where user_id = auth.uid()
    )
  );

-- Allow authenticated users to delete their own files.
create policy "assets: authenticated delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] in (
      select id::text from public.projects where user_id = auth.uid()
    )
  );
