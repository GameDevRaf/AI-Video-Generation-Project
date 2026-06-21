-- ============================================================
-- 003 — User settings table
-- Run in Supabase SQL Editor after 002_exports_table.sql
-- ============================================================

create table if not exists public.user_settings (
  user_id                uuid primary key references public.users(id) on delete cascade,
  prompt_edit_mode       text not null default 'after_generation',
  default_audio_provider text not null default 'elevenlabs',
  default_audio_voice_id text,
  default_image_model    text,
  default_video_model    text,
  default_music_model    text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings: all own" on public.user_settings
  for all using (auth.uid() = user_id);

-- Auto-create a settings row when a user profile is created
create or replace function public.handle_new_user_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_user_created_settings on public.users;
create trigger on_user_created_settings
  after insert on public.users
  for each row execute procedure public.handle_new_user_settings();
