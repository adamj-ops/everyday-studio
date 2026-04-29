import { AgentIntent } from "../lib/agent/intent-schema";
import { handleAgentIntent } from "../lib/agent/handlers";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const PROPERTY_ID = "00000000-0000-4000-8000-000000000010";
const SPACE_ID = "00000000-0000-4000-8000-000000000020";
const BRIEF_ID = "00000000-0000-4000-8000-000000000030";
const PHOTO_ID = "00000000-0000-4000-8000-000000000040";
const RENDER_ID = "00000000-0000-4000-8000-000000000050";

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<[string, unknown]> = [];
  private insertRows: Row[] | null = null;
  private updatePatch: Row | null = null;

  constructor(private readonly db: Record<string, Row[]>, private readonly table: string) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  insert(row: Row | Row[]) {
    this.insertRows = Array.isArray(row) ? row : [row];
    return this;
  }

  update(row: Row) {
    this.updatePatch = row;
    return this;
  }

  async maybeSingle() {
    if (this.updatePatch) {
      const row = this.matchingRows()[0] ?? null;
      if (!row) return { data: null, error: null };
      Object.assign(row, this.updatePatch);
      return { data: row, error: null };
    }
    return { data: this.matchingRows()[0] ?? null, error: null };
  }

  async single() {
    if (this.insertRows) {
      const row = {
        id: generatedIdFor(this.table),
        created_at: new Date(0).toISOString(),
        ...this.insertRows[0],
      };
      this.db[this.table] ??= [];
      this.db[this.table].push(row);
      return { data: row, error: null };
    }
    return { data: this.matchingRows()[0] ?? null, error: null };
  }

  private matchingRows() {
    return (this.db[this.table] ?? []).filter((row) =>
      this.filters.every(([column, value]) => row[column] === value),
    );
  }
}

function generatedIdFor(table: string): string {
  if (table === "properties") return PROPERTY_ID;
  if (table === "spaces") return SPACE_ID;
  if (table === "space_briefs") return BRIEF_ID;
  if (table === "renders") return RENDER_ID;
  return "00000000-0000-4000-8000-000000000099";
}

function fakeSupabase(db: Record<string, Row[]>) {
  return {
    from(table: string) {
      return new FakeQuery(db, table);
    },
  };
}

async function runIntent(payload: unknown, db: Record<string, Row[]>) {
  const parsed = AgentIntent.safeParse(payload);
  if (!parsed.success) throw new Error(`schema failed for ${(payload as { intent?: string }).intent}`);
  const result = await handleAgentIntent(parsed.data, {
    supabase: fakeSupabase(db) as never,
    requestId: "test-request",
  });
  if (!result.ok) {
    throw new Error(`${parsed.data.intent} failed: ${result.error.code} ${result.error.message}`);
  }
  console.log(`ok ${parsed.data.intent}`);
}

async function main() {
  const db: Record<string, Row[]> = {
    agent_user_links: [{ user_slack_id: "U123", user_id: USER_ID }],
    properties: [],
    project_themes: [],
    spaces: [],
    space_briefs: [],
    property_photos: [{ id: PHOTO_ID, property_id: PROPERTY_ID }],
    renders: [],
    brief_references: [],
    saved_references: [],
  };

  await runIntent(
    {
      intent: "create_property",
      user_slack_id: "U123",
      payload: {
        address: "123 Test St, Minneapolis, MN 55401",
        brand: "everyday",
        budget_tier: "mid",
      },
    },
    db,
  );

  await runIntent(
    {
      intent: "create_brief",
      user_slack_id: "U123",
      property_id: PROPERTY_ID,
      payload: {
        surface_type: "facade",
        creative_direction: "Warm restored bungalow facade.",
        non_negotiables: ["Preserve windows"],
        designer_references: ["Gil Schafer"],
      },
    },
    db,
  );

  await runIntent(
    {
      intent: "trigger_render",
      user_slack_id: "U123",
      property_id: PROPERTY_ID,
      payload: {
        brief_id: BRIEF_ID,
        base_photo_id: PHOTO_ID,
      },
    },
    db,
  );

  await runIntent(
    {
      intent: "approve_render",
      user_slack_id: "U123",
      payload: {
        render_id: RENDER_ID,
        approval_rationale: "On brief.",
      },
    },
    db,
  );

  await runIntent(
    {
      intent: "attach_reference",
      user_slack_id: "U123",
      payload: {
        brief_id: BRIEF_ID,
        image_url_or_blob: "https://example.com/reference.jpg",
        category: "palette",
        source_url: "https://example.com",
      },
    },
    db,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
