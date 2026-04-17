-- Everyday Studio — storage setup (Session 4)
--
-- Three private buckets. Ownership is enforced at the `storage.objects` level
-- by matching the first path segment (`{property_id}/...`) against
-- `properties.owner_id = auth.uid()`.
--
-- Path convention:
--   property-photos      {property_id}/{uuid}.{ext}   base/before photos
--   property-references  {property_id}/{uuid}.{ext}   designer refs (Session 6)
--   renders              {property_id}/{uuid}.{ext}   Gemini outputs (Session 6)

-- ---------------------------------------------------------------------------
-- rooms: idempotent upsert on (property_id, room_type, label)
-- ---------------------------------------------------------------------------
alter table rooms
  add constraint rooms_property_type_label_key
  unique (property_id, room_type, label);

-- ---------------------------------------------------------------------------
-- buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('property-photos', 'property-photos', false),
  ('property-references', 'property-references', false),
  ('renders', 'renders', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- helper: does the authenticated user own the property whose id is the
-- first segment of an object `name`?
-- ---------------------------------------------------------------------------
--
-- storage.foldername(name) returns text[] of path segments. For
-- '{property_id}/{uuid}.jpg' the first segment is the property id.

-- property-photos: owner of the property can select / insert / delete
create policy "property_photos_owner_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'property-photos'
  and exists (
    select 1 from properties
    where properties.id::text = (storage.foldername(name))[1]
      and properties.owner_id = auth.uid()
  )
);

create policy "property_photos_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'property-photos'
  and exists (
    select 1 from properties
    where properties.id::text = (storage.foldername(name))[1]
      and properties.owner_id = auth.uid()
  )
);

create policy "property_photos_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'property-photos'
  and exists (
    select 1 from properties
    where properties.id::text = (storage.foldername(name))[1]
      and properties.owner_id = auth.uid()
  )
);

-- property-references
create policy "property_references_owner_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'property-references'
  and exists (
    select 1 from properties
    where properties.id::text = (storage.foldername(name))[1]
      and properties.owner_id = auth.uid()
  )
);

create policy "property_references_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'property-references'
  and exists (
    select 1 from properties
    where properties.id::text = (storage.foldername(name))[1]
      and properties.owner_id = auth.uid()
  )
);

create policy "property_references_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'property-references'
  and exists (
    select 1 from properties
    where properties.id::text = (storage.foldername(name))[1]
      and properties.owner_id = auth.uid()
  )
);

-- renders
create policy "renders_owner_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'renders'
  and exists (
    select 1 from properties
    where properties.id::text = (storage.foldername(name))[1]
      and properties.owner_id = auth.uid()
  )
);

create policy "renders_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'renders'
  and exists (
    select 1 from properties
    where properties.id::text = (storage.foldername(name))[1]
      and properties.owner_id = auth.uid()
  )
);

create policy "renders_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'renders'
  and exists (
    select 1 from properties
    where properties.id::text = (storage.foldername(name))[1]
      and properties.owner_id = auth.uid()
  )
);
