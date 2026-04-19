-- Everyday Studio — renders spec link + idempotency + pipeline status (Session 6)
--
-- Links a render to the exact versioned spec used to produce it, adds a
-- server-side idempotency key to tame double-submits, extends the status
-- check constraint so pipeline progress is pollable from the renders row
-- itself, and adds a parent pointer for conversational-edit chains.
--
-- The property-references and renders Storage buckets already exist from
-- migration 0002; nothing to do for buckets here.

-- ---------------------------------------------------------------------------
-- renders.room_spec_id — FK to the exact spec version used
-- ---------------------------------------------------------------------------
alter table renders
  add column room_spec_id uuid references room_specs(id) on delete set null;

create index idx_renders_spec on renders(room_spec_id);

-- ---------------------------------------------------------------------------
-- renders.idempotency_key — server-side double-submit guard
-- ---------------------------------------------------------------------------
alter table renders
  add column idempotency_key text;

create unique index idx_renders_idempotency
  on renders(room_id, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- renders.status — expand the check constraint to include intermediate
-- pipeline states so the client can poll progress from this one column.
--
-- Old states: pending | rendering | complete | failed
-- New states add: prompt_review, image_review, complete_qa_pending,
--                 gated_by_opus
-- ---------------------------------------------------------------------------
alter table renders drop constraint if exists renders_status_check;

alter table renders
  add constraint renders_status_check
  check (status in (
    'pending',
    'prompt_review',
    'rendering',
    'image_review',
    'complete',
    'complete_qa_pending',
    'gated_by_opus',
    'failed'
  ));

-- ---------------------------------------------------------------------------
-- renders.parent_render_id — conversational-edit lineage
-- ---------------------------------------------------------------------------
alter table renders
  add column parent_render_id uuid references renders(id) on delete set null;

create index idx_renders_parent on renders(parent_render_id);
