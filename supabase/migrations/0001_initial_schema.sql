-- Everyday Studio — initial schema (Session 3)
--
-- Six tables backing the Property Setup → Room Spec Builder → Mockup Studio
-- flow. RLS is enabled with owner-scoped policies. Tighten further in
-- Session 6.
--
-- ENUM VALIDATION POLICY
-- The buyer_persona and room_type columns are plain `text` on purpose.
-- Zod owns enum validation at the API boundary (lib/specs/schema.ts:
-- BuyerPersonaEnum, the room_type literals on the discriminated union).
-- This avoids a CHECK-constraint drift problem where the DB enum and the
-- Zod enum can diverge silently. If you need to evolve enums, edit Zod
-- and the API route validation; the DB will accept whatever Zod accepts.

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------
create table properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  address text not null,
  city text not null,
  state text not null default 'MN',
  zip text not null,
  arv_estimate numeric,
  buyer_persona text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- property_photos (base images for rendering)
-- ---------------------------------------------------------------------------
create table property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade not null,
  storage_path text not null,
  room_label text,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
create table rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade not null,
  room_type text not null,
  label text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- room_specs (the locked spec contract from lib/specs/schema.ts)
-- ---------------------------------------------------------------------------
create table room_specs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade not null,
  spec_json jsonb not null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reference_materials (designer-uploaded inspiration images)
-- ---------------------------------------------------------------------------
create table reference_materials (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade not null,
  room_id uuid references rooms(id) on delete cascade,
  storage_path text not null,
  label text not null,
  scope text not null default 'property' check (scope in ('property', 'room')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- renders (Gemini outputs + Opus QA verdict)
-- ---------------------------------------------------------------------------
create table renders (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade not null,
  base_photo_id uuid references property_photos(id) on delete set null,
  prompt_text text not null,
  opus_verdict text check (opus_verdict in ('ship_it', 'revise', 'regenerate')),
  opus_critiques_json jsonb,
  storage_path text,
  status text not null default 'pending' check (status in ('pending', 'rendering', 'complete', 'failed')),
  error_message text,
  cost_estimate_cents int,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------
create index idx_properties_owner on properties(owner_id);
create index idx_property_photos_property on property_photos(property_id);
create index idx_rooms_property on rooms(property_id);
create index idx_room_specs_room on room_specs(room_id);
create index idx_reference_materials_property on reference_materials(property_id);
create index idx_renders_room on renders(room_id);

-- ---------------------------------------------------------------------------
-- row-level security
-- ---------------------------------------------------------------------------
alter table properties enable row level security;
alter table property_photos enable row level security;
alter table rooms enable row level security;
alter table room_specs enable row level security;
alter table reference_materials enable row level security;
alter table renders enable row level security;

-- properties: owner only
create policy "properties_owner_all" on properties
  for all using (auth.uid() = owner_id);

-- child tables: cascade owner check through the parent property
create policy "property_photos_via_property" on property_photos
  for all using (
    exists (
      select 1 from properties
      where properties.id = property_photos.property_id
        and properties.owner_id = auth.uid()
    )
  );

create policy "rooms_via_property" on rooms
  for all using (
    exists (
      select 1 from properties
      where properties.id = rooms.property_id
        and properties.owner_id = auth.uid()
    )
  );

create policy "room_specs_via_room" on room_specs
  for all using (
    exists (
      select 1 from rooms
      join properties on properties.id = rooms.property_id
      where rooms.id = room_specs.room_id
        and properties.owner_id = auth.uid()
    )
  );

create policy "reference_materials_via_property" on reference_materials
  for all using (
    exists (
      select 1 from properties
      where properties.id = reference_materials.property_id
        and properties.owner_id = auth.uid()
    )
  );

create policy "renders_via_room" on renders
  for all using (
    exists (
      select 1 from rooms
      join properties on properties.id = rooms.property_id
      where rooms.id = renders.room_id
        and properties.owner_id = auth.uid()
    )
  );
