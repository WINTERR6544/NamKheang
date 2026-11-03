-- Profile pictures for every role (customer, shop, factory).
-- Public bucket "avatars": the browser shows the picture by its public URL. Each signed-in user may
-- only add, read the list of, or delete files in their own folder "<auth uid>/". Pictures are
-- resized to 256x256 in the browser before upload; the bucket also caps size and type.
-- The picture's URL is kept on the login account (auth user_metadata.avatar_url), so no table changes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: owner reads own folder" on storage.objects;
create policy "avatars: owner reads own folder" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: owner uploads to own folder" on storage.objects;
create policy "avatars: owner uploads to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: owner deletes own files" on storage.objects;
create policy "avatars: owner deletes own files" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
