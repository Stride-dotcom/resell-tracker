-- Private storage bucket for all item media (photos, checks, receipts, agreements).
-- The authenticated app reads via short-lived signed URLs; the public share page
-- reads item photos through the `public-item` edge function (service role).

insert into storage.buckets (id, name, public)
values ('item-media', 'item-media', false)
on conflict (id) do nothing;

-- Owners may read/write only objects under their own user-id folder:  {auth.uid()}/...
create policy "media read own"
  on storage.objects for select
  using (bucket_id = 'item-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media insert own"
  on storage.objects for insert
  with check (bucket_id = 'item-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media delete own"
  on storage.objects for delete
  using (bucket_id = 'item-media' and (storage.foldername(name))[1] = auth.uid()::text);
