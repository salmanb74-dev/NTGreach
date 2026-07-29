-- Support chat media Storage bucket + policies
--
-- PREREQUISITE: create the bucket in Dashboard if this insert is skipped:
--   Storage → New bucket → name: support-files → Public bucket: ON
--
-- Then run this in SQL Editor (safe to re-run).

insert into storage.buckets (id, name, public)
values ('support-files', 'support-files', true)
on conflict (id) do update set public = true;

-- Public read (bucket is public; policy still required for RLS on storage.objects)
drop policy if exists "support_files_public_read" on storage.objects;
create policy "support_files_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'support-files');

-- Authenticated CS agents can upload
drop policy if exists "support_files_cs_upload" on storage.objects;
create policy "support_files_cs_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'support-files'
    and public.is_cs_agent()
  );

-- Authenticated CS agents can delete their uploads if needed
drop policy if exists "support_files_cs_delete" on storage.objects;
create policy "support_files_cs_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'support-files'
    and public.is_cs_agent()
  );
