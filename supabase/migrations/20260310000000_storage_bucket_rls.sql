-- Migration: Create media storage bucket and RLS policies
-- Idempotent — safe to run multiple times.

-- 1. Create the `media` bucket (public-read)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- 2. Public read policy: anyone can read from the media bucket
drop policy if exists "Public read access for media bucket" on storage.objects;
create policy "Public read access for media bucket"
  on storage.objects for select
  using (bucket_id = 'media');

-- 3. Artist INSERT policy: write only to own tenant folder
drop policy if exists "Artists can upload to own tenant folder" on storage.objects;
create policy "Artists can upload to own tenant folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );

-- 4. Artist UPDATE policy: replace-in-place within own tenant folder
drop policy if exists "Artists can update own tenant files" on storage.objects;
create policy "Artists can update own tenant files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
  );

-- 5. Media table INSERT policy: authenticated users can insert media rows
drop policy if exists "Authenticated users can insert media rows" on media;
create policy "Authenticated users can insert media rows"
  on media for insert
  to authenticated
  with check (true);
