create or replace function public.storage_path_is_own_family(_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare fid uuid;
begin
  begin
    fid := ((storage.foldername(_name))[1])::uuid;
  exception when others then
    return false;
  end;
  return exists (select 1 from public.families where id = fid and wife_user_id = auth.uid());
end; $$;
revoke all on function public.storage_path_is_own_family(text) from public, anon;
grant execute on function public.storage_path_is_own_family(text) to authenticated;

create policy "family_files_admin_all" on storage.objects for all to authenticated
  using (bucket_id = 'family-files' and public.has_role(auth.uid(),'admin'))
  with check (bucket_id = 'family-files' and public.has_role(auth.uid(),'admin'));

create policy "family_files_owner_all" on storage.objects for all to authenticated
  using (bucket_id = 'family-files' and public.storage_path_is_own_family(name))
  with check (bucket_id = 'family-files' and public.storage_path_is_own_family(name));