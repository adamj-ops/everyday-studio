-- Everyday Studio — surface types + spaces rename
--
-- Extends versioned briefs beyond interior rooms and renames the active
-- room/brief model to spaces/space_briefs. Legacy room_specs and
-- reference_materials are retained; their room_id columns now reference the
-- renamed spaces table through Postgres' table-rename behavior.

-- ---------------------------------------------------------------------------
-- surface_type — v1 supports interior rooms plus exterior surfaces
-- ---------------------------------------------------------------------------
alter table room_briefs
  add column surface_type text not null default 'interior_room'
  check (surface_type in (
    'interior_room',
    'facade',
    'hardscape',
    'landscape',
    'garden'
  ));

-- ---------------------------------------------------------------------------
-- active model rename: rooms -> spaces, room_briefs -> space_briefs
-- ---------------------------------------------------------------------------
alter table rooms rename to spaces;
alter table spaces rename column room_type to space_type;

alter table room_briefs rename to space_briefs;
alter table space_briefs rename column room_id to space_id;

alter table renders rename column room_id to space_id;

alter table saved_references rename column room_type to space_type;

-- ---------------------------------------------------------------------------
-- constraints and indexes
-- ---------------------------------------------------------------------------
alter table spaces
  rename constraint rooms_property_type_label_key to spaces_property_type_label_key;

alter table space_briefs
  rename constraint room_briefs_room_id_version_key to space_briefs_space_id_version_key;

alter index if exists idx_rooms_property rename to idx_spaces_property;
alter index if exists idx_room_briefs_room rename to idx_space_briefs_space;
alter index if exists idx_renders_room rename to idx_renders_space;
alter index if exists idx_renders_idempotency rename to idx_renders_space_idempotency;
alter index if exists saved_references_user_room_type_idx rename to saved_references_user_space_type_idx;

-- Rebuild the partial unique index so it keys on the renamed column.
drop index if exists idx_renders_space_idempotency;
create unique index idx_renders_space_idempotency
  on renders(space_id, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- RLS policy names and expressions
-- ---------------------------------------------------------------------------
drop policy if exists "rooms_via_property" on spaces;
create policy "spaces_via_property" on spaces
  for all using (
    exists (
      select 1 from properties
      where properties.id = spaces.property_id
        and properties.owner_id = auth.uid()
    )
  );

drop policy if exists "room_briefs_via_room" on space_briefs;
create policy "space_briefs_via_space" on space_briefs
  for all using (
    exists (
      select 1 from spaces
      join properties on properties.id = spaces.property_id
      where spaces.id = space_briefs.space_id
        and properties.owner_id = auth.uid()
    )
  );

drop policy if exists "renders_via_room" on renders;
create policy "renders_via_space" on renders
  for all using (
    exists (
      select 1 from spaces
      join properties on properties.id = spaces.property_id
      where spaces.id = renders.space_id
        and properties.owner_id = auth.uid()
    )
  );
