-- Everyday Studio — Hermes agent service role
--
-- Hermes authenticates at the Studio API boundary with STUDIO_AGENT_API_KEY.
-- Database writes are scoped through agent_user_links, which maps a Slack user
-- id to the Studio auth.users owner id used by existing property RLS.

do $$ begin
  create role agent_service noinherit;
exception when duplicate_object then null; end $$;

create table if not exists agent_user_links (
  user_slack_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists agent_user_links_user_id_idx
  on agent_user_links(user_id);

alter table agent_user_links enable row level security;

create table if not exists brief_references (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references space_briefs(id) on delete cascade,
  image_url_or_blob text not null,
  category text not null,
  source_url text,
  classification_notes text,
  created_at timestamptz not null default now()
);

create index if not exists brief_references_brief_id_idx
  on brief_references(brief_id);

alter table brief_references enable row level security;

alter table renders
  add column if not exists approved_at timestamptz,
  add column if not exists approval_rationale text;

grant usage on schema public to agent_service;

grant select on
  agent_user_links,
  properties,
  spaces,
  space_briefs,
  renders,
  brief_references,
  saved_references,
  project_themes,
  property_photos
to agent_service;

grant insert, update on
  properties,
  spaces,
  space_briefs,
  project_themes,
  renders,
  brief_references,
  saved_references
to agent_service;

revoke delete, truncate on all tables in schema public from agent_service;
revoke all on table auth.users from agent_service;

-- Existing owner-scoped policies continue serving authenticated Studio users.
-- These policies let the internal API use a constrained PostgREST role; Hermes
-- ownership checks happen in app/api/agent/intent before any write.
create policy "agent_user_links_agent_select" on agent_user_links
  for select to agent_service
  using (true);

create policy "properties_agent_rw" on properties
  for all to agent_service
  using (true)
  with check (true);

create policy "spaces_agent_rw" on spaces
  for all to agent_service
  using (true)
  with check (true);

create policy "space_briefs_agent_rw" on space_briefs
  for all to agent_service
  using (true)
  with check (true);

create policy "renders_agent_rw" on renders
  for all to agent_service
  using (true)
  with check (true);

create policy "saved_references_agent_rw" on saved_references
  for all to agent_service
  using (true)
  with check (true);

create policy "brief_references_agent_rw" on brief_references
  for all to agent_service
  using (true)
  with check (true);

create policy "project_themes_agent_rw" on project_themes
  for all to agent_service
  using (true)
  with check (true);

create policy "property_photos_agent_select" on property_photos
  for select to agent_service
  using (true);
