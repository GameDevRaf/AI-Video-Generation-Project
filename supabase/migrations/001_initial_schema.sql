-- ============================================================
-- 001 — Initial Schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- ---- 1. users profile table ----
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique,
  email      text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table public.users enable row level security;

create policy "users: read own" on public.users
  for select using (auth.uid() = id);

create policy "users: update own" on public.users
  for update using (auth.uid() = id);


-- ---- 2. projects ----
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  name          text not null,
  description   text,
  status        text not null default 'active',
  current_stage text not null default 'script',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects: all own" on public.projects
  for all using (auth.uid() = user_id);


-- ---- 3. jobs ----
create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  type            text not null,   -- script | scene_split | image_prompt | image | audio | video_prompt | video | music | export | publish
  status          text not null default 'queued',  -- queued | processing | waiting_on_provider | completed | failed | retrying
  provider        text,
  model           text,
  input           jsonb,
  output_summary  jsonb,
  error_message   text,
  retry_count     integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

create index if not exists jobs_project_status_idx on public.jobs (project_id, status);
create index if not exists jobs_status_created_idx on public.jobs (status, created_at);

alter table public.jobs enable row level security;

create policy "jobs: all own" on public.jobs
  for all using (auth.uid() = user_id);


-- ---- 4. job_outputs ----
create table if not exists public.job_outputs (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  type         text not null,   -- text | image | audio | video | music | json | file
  label        text,
  storage_url  text,
  storage_path text,
  mime_type    text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

alter table public.job_outputs enable row level security;

create policy "job_outputs: read own" on public.job_outputs
  for select using (
    exists (
      select 1 from public.jobs j
      where j.id = job_outputs.job_id
        and j.user_id = auth.uid()
    )
  );

create policy "job_outputs: insert own" on public.job_outputs
  for insert with check (
    exists (
      select 1 from public.jobs j
      where j.id = job_outputs.job_id
        and j.user_id = auth.uid()
    )
  );


-- ---- 5. scenes ----
create table if not exists public.scenes (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  job_id      uuid references public.jobs(id),
  scene_index integer not null,
  title       text,
  script_text text not null,
  start_time  numeric,
  end_time    numeric,
  duration    numeric,
  order_index integer not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists scenes_project_order_idx on public.scenes (project_id, order_index);

alter table public.scenes enable row level security;

create policy "scenes: all own" on public.scenes
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = scenes.project_id
        and p.user_id = auth.uid()
    )
  );


-- ---- 6. scene_assets ----
create table if not exists public.scene_assets (
  id             uuid primary key default gen_random_uuid(),
  scene_id       uuid not null references public.scenes(id) on delete cascade,
  job_output_id  uuid not null references public.job_outputs(id),
  asset_type     text not null,
  role           text not null,   -- first_frame | voice | generated_video | music_bed
  created_at     timestamptz not null default now()
);

alter table public.scene_assets enable row level security;

create policy "scene_assets: read own" on public.scene_assets
  for select using (
    exists (
      select 1
      from public.scenes s
      join public.projects p on p.id = s.project_id
      where s.id = scene_assets.scene_id
        and p.user_id = auth.uid()
    )
  );

create policy "scene_assets: insert own" on public.scene_assets
  for insert with check (
    exists (
      select 1
      from public.scenes s
      join public.projects p on p.id = s.project_id
      where s.id = scene_assets.scene_id
        and p.user_id = auth.uid()
    )
  );


-- ---- 7. project_settings ----
create table if not exists public.project_settings (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null unique references public.projects(id) on delete cascade,
  prompt_edit_mode     text not null default 'after_generation',  -- before_generation | after_generation
  default_image_model  text,
  default_audio_model  text,
  default_video_model  text,
  default_music_model  text,
  timeline_density     text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.project_settings enable row level security;

create policy "project_settings: all own" on public.project_settings
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_settings.project_id
        and p.user_id = auth.uid()
    )
  );


-- ---- 8. api_keys ----
create table if not exists public.api_keys (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  provider         text not null,
  key_name         text,
  encrypted_secret text not null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.api_keys enable row level security;

-- Users can only see metadata (no encrypted_secret) — secret is only read server-side via service role key
create policy "api_keys: read own" on public.api_keys
  for select using (auth.uid() = user_id);

create policy "api_keys: insert own" on public.api_keys
  for insert with check (auth.uid() = user_id);

create policy "api_keys: update own" on public.api_keys
  for update using (auth.uid() = user_id);

create policy "api_keys: delete own" on public.api_keys
  for delete using (auth.uid() = user_id);


-- ---- 9. connected_accounts ----
create table if not exists public.connected_accounts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  provider           text not null,
  account_label      text,
  auth_type          text,
  connection_status  text not null default 'active',
  session_reference  text,
  metadata           jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.connected_accounts enable row level security;

create policy "connected_accounts: all own" on public.connected_accounts
  for all using (auth.uid() = user_id);
