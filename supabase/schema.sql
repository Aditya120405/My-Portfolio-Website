-- Run this ONCE in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- It is safe to run again later (it recreates the rules without duplicating anything).
-- Change the email below if your admin account is different (it must match VITE_ADMIN_EMAIL).

-- 1) Content table: one row ("main") holds all site content as JSON
create table if not exists public.site_content (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;

-- 2) Who is the admin?
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = lower('aadityajain01223@gmail.com')
$$;

-- 3) Rules: everyone can READ, only the admin can WRITE
drop policy if exists "public can read content" on public.site_content;
drop policy if exists "admin can insert content" on public.site_content;
drop policy if exists "admin can update content" on public.site_content;
drop policy if exists "admin can delete content" on public.site_content;
create policy "public can read content" on public.site_content for select using (true);
create policy "admin can insert content" on public.site_content for insert with check (public.is_admin());
create policy "admin can update content" on public.site_content for update using (public.is_admin()) with check (public.is_admin());
create policy "admin can delete content" on public.site_content for delete using (public.is_admin());

-- 4) Live updates (Realtime) for the content table
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_content') then
    alter publication supabase_realtime add table public.site_content;
  end if;
end $$;

-- 5) File storage: a public bucket (50 MB per file on the free plan)
insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "admin can upload files" on storage.objects;
drop policy if exists "admin can change files" on storage.objects;
drop policy if exists "admin can delete files" on storage.objects;
create policy "admin can upload files" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and public.is_admin());
create policy "admin can change files" on storage.objects for update to authenticated
  using (bucket_id = 'uploads' and public.is_admin()) with check (bucket_id = 'uploads' and public.is_admin());
create policy "admin can delete files" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and public.is_admin());
