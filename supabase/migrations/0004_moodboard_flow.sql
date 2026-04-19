-- Everyday Studio — moodboard flow (Session 7)
--
-- Replaces the structured RoomSpec discriminated union with a moodboard +
-- creative-direction + non-negotiables workflow. This migration is ADDITIVE:
-- `room_specs` and `reference_materials` stay in place (no drops) but the
-- application no longer writes to them. Latest `room_briefs` row wins for
-- render inputs; one `project_themes` row per property gates budget/theme.
--
-- ENUM VALIDATION POLICY (unchanged from 0001)
-- Zod in lib/briefs/schema.ts owns enum validation at the API boundary.
-- The CHECK constraints below are belt-and-suspenders; extend Zod when you
-- need to evolve the allowed values, not the DB.

-- ---------------------------------------------------------------------------
-- project_themes — one per property
-- ---------------------------------------------------------------------------
create table if not exists project_themes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade not null unique,
  budget_tier text not null check (budget_tier in (
    'builder_grade', 'mid_tier', 'high_end', 'luxury', 'custom'
  )),
  budget_custom_notes text,
  theme_preset text check (theme_preset in (
    'japandi', 'scandinavian', 'modern_farmhouse', 'craftsman',
    'mid_century_modern', 'organic_modern', 'traditional', 'transitional',
    'coastal', 'industrial', 'custom'
  )),
  theme_custom_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- room_briefs — versioned per room (INSERT on every save, never UPDATE)
-- ---------------------------------------------------------------------------
create table if not exists room_briefs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade not null,
  version int not null default 1,
  creative_answers jsonb not null default '{}'::jsonb,
  non_negotiables text,
  category_moodboards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, version)
);

create index if not exists idx_room_briefs_room on room_briefs(room_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table project_themes enable row level security;
alter table room_briefs enable row level security;

do $$ begin
  create policy "project_themes_via_property" on project_themes
    for all using (
      exists (
        select 1 from properties
        where properties.id = project_themes.property_id
          and properties.owner_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "room_briefs_via_room" on room_briefs
    for all using (
      exists (
        select 1 from rooms
        join properties on properties.id = rooms.property_id
        where rooms.id = room_briefs.room_id
          and properties.owner_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;
