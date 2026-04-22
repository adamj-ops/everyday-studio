-- Everyday Studio — per-user saved reference favorites (Session 10)
-- category stores moodboard category_key (e.g. appliances, cabinetry).

create table if not exists saved_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  original_filename text,
  category text not null,
  room_type text,
  label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, storage_path)
);

create index if not exists saved_references_user_category_idx
  on saved_references (user_id, category);

create index if not exists saved_references_user_room_type_idx
  on saved_references (user_id, room_type);

alter table saved_references enable row level security;

create policy "Users manage their own favorites"
  on saved_references for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
