-- Create a public bucket for Kanban assets
insert into storage.buckets (id, name, public)
values ('kanban_assets', 'kanban_assets', true)
on conflict (id) do nothing;

-- Set up storage policies to allow authenticated users to manage files
create policy "Allow authenticated users to upload kanban assets"
  on storage.objects for insert with check (bucket_id = 'kanban_assets' and auth.role() = 'authenticated');

create policy "Allow authenticated users to update kanban assets"
  on storage.objects for update with check (bucket_id = 'kanban_assets' and auth.role() = 'authenticated');

create policy "Allow everyone to read kanban assets"
  on storage.objects for select using (bucket_id = 'kanban_assets');

create policy "Allow authenticated users to delete kanban assets"
  on storage.objects for delete using (bucket_id = 'kanban_assets' and auth.role() = 'authenticated');
