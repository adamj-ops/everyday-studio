import { type NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { anthropicClient, CLAUDE_OPERATOR_MODEL } from "@/lib/claude/client";
import { buildSuggestFieldRequest, type SuggestionOutput } from "@/lib/claude/suggest";
import type { PropertyContext, RoomSpec } from "@/lib/specs/schema";

const RoomIdSchema = z.string().uuid();

const SuggestBodySchema = z.object({
  field_path: z.string().min(1).max(200),
  partial_spec: z.record(z.unknown()),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!RoomIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SuggestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Fetch room + property under RLS so we have real context for the prompt and
  // so we don't leak across users. One query with a join.
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("id, room_type, label, property_id, properties(*)")
    .eq("id", id)
    .maybeSingle();

  if (roomErr) {
    return NextResponse.json({ error: roomErr.message }, { status: 500 });
  }
  if (!room) {
    return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  }

  // Supabase types the embedded relation as an array; a belongs-to join only
  // ever returns at most one row. Cast through unknown to get past TS strictness.
  const rawProperties = (room as unknown as { properties?: unknown }).properties;
  const propertyRow = Array.isArray(rawProperties)
    ? (rawProperties[0] as Record<string, unknown> | undefined)
    : (rawProperties as Record<string, unknown> | undefined);
  if (!propertyRow) {
    return NextResponse.json({ error: "property_not_found" }, { status: 404 });
  }

  // Coerce the property row into PropertyContext. DB columns don't 1:1 match
  // the Zod PropertyContext shape; map fields carefully. Missing fields (ARV,
  // rehab budget) fall back to 0 so Sonnet still gets *something*.
  const context: PropertyContext = {
    address: String(propertyRow.address ?? ""),
    arv: Number(propertyRow.arv_estimate ?? 0) || 1,
    purchase_price: 1, // not tracked on properties table; stub non-zero
    rehab_budget: 1, // not tracked yet; stub non-zero
    buyer_persona: (propertyRow.buyer_persona as PropertyContext["buyer_persona"]) ??
      "young_family",
    neighborhood_notes: null,
    style_direction: null,
  };

  const { system, user: userMsg } = buildSuggestFieldRequest({
    context,
    room_type: room.room_type as RoomSpec["room_type"],
    room_name: (room as { label?: string }).label ?? "",
    field_path: parsed.data.field_path,
    partial_spec: parsed.data.partial_spec,
  });

  const response = await anthropicClient.messages.create({
    model: CLAUDE_OPERATOR_MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsedOut: SuggestionOutput;
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
    parsedOut = JSON.parse(cleaned) as SuggestionOutput;
    if (typeof parsedOut !== "object" || parsedOut === null) {
      throw new Error("response is not an object");
    }
    if (!("suggested_value" in parsedOut) || typeof parsedOut.reasoning !== "string") {
      throw new Error("response does not match { suggested_value, reasoning } shape");
    }
  } catch (err) {
    console.error(
      "[suggest] parse error",
      { room_id: id, field_path: parsed.data.field_path, raw: text.slice(0, 400) },
    );
    return NextResponse.json(
      {
        error: "parse_error",
        detail: err instanceof Error ? err.message : "unknown parse failure",
        raw_excerpt: text.slice(0, 200),
      },
      { status: 502 },
    );
  }

  const usage = response.usage;
  console.log(
    `[suggest] room_id=${id} room_type=${room.room_type} field_path=${parsed.data.field_path} ` +
      `input_tokens=${usage?.input_tokens ?? "?"} output_tokens=${usage?.output_tokens ?? "?"}`,
  );

  return NextResponse.json({
    suggested_value: parsedOut.suggested_value,
    reasoning: parsedOut.reasoning,
    token_usage: {
      input_tokens: usage?.input_tokens,
      output_tokens: usage?.output_tokens,
    },
  });
}
