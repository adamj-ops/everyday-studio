import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentErrorCode, AgentIntent } from "@/lib/agent/intent-schema";
import type { SurfaceType } from "@/lib/briefs/schema";

type HandlerContext = {
  supabase: SupabaseClient;
  requestId: string;
};

export type AgentHandlerResponse =
  | { ok: true; intent: AgentIntent["intent"]; result: unknown }
  | {
      ok: false;
      intent: AgentIntent["intent"];
      error: { code: AgentErrorCode; message: string; details?: unknown };
    };

const BUDGET_MAP = {
  builder: "builder_grade",
  mid: "mid_tier",
  high: "high_end",
  luxury: "luxury",
  custom: "custom",
} as const;

export async function handleAgentIntent(
  intent: AgentIntent,
  ctx: HandlerContext,
): Promise<AgentHandlerResponse> {
  logAgent(ctx, intent, "dispatch");

  switch (intent.intent) {
    case "create_property":
      return createProperty(intent, ctx);
    case "create_brief":
      return createBrief(intent, ctx);
    case "trigger_render":
      return triggerRender(intent, ctx);
    case "approve_render":
      return approveRender(intent, ctx);
    case "attach_reference":
      return attachReference(intent, ctx);
  }
}

async function createProperty(
  intent: Extract<AgentIntent, { intent: "create_property" }>,
  ctx: HandlerContext,
): Promise<AgentHandlerResponse> {
  const owner = await resolveOwner(intent.user_slack_id, ctx);
  if (!owner) return fail(intent.intent, "NOT_FOUND", "No Studio user is linked to this Slack id.");

  const address = parseAddress(intent.payload);
  if (!address) {
    return fail(
      intent.intent,
      "INVALID_PAYLOAD",
      "Property address must include city, state, and zip or provide them as structured fields.",
    );
  }

  const { data: property, error } = await ctx.supabase
    .from("properties")
    .insert({
      owner_id: owner.user_id,
      address: address.street,
      city: address.city,
      state: address.state,
      zip: address.zip,
      buyer_persona: intent.payload.brand === "bevs_garden_co" ? "bevs_garden_co" : null,
    })
    .select("*")
    .single();
  if (error || !property) {
    return fail(intent.intent, "INTERNAL_ERROR", "Failed to create property.", error);
  }

  const { data: theme, error: themeError } = await ctx.supabase
    .from("project_themes")
    .insert({
      property_id: property.id,
      budget_tier: BUDGET_MAP[intent.payload.budget_tier],
      budget_custom_notes: intent.payload.budget_tier === "custom" ? "Created by Hermes." : null,
      theme_preset: null,
      theme_custom_description: null,
    })
    .select("*")
    .single();
  if (themeError) {
    return fail(intent.intent, "INTERNAL_ERROR", "Property created but theme insert failed.", {
      property,
      themeError,
    });
  }

  return ok(intent.intent, { property, theme });
}

async function createBrief(
  intent: Extract<AgentIntent, { intent: "create_brief" }>,
  ctx: HandlerContext,
): Promise<AgentHandlerResponse> {
  const owner = await resolveOwner(intent.user_slack_id, ctx);
  if (!owner) return fail(intent.intent, "NOT_FOUND", "No Studio user is linked to this Slack id.");

  const { data: property } = await ctx.supabase
    .from("properties")
    .select("id")
    .eq("id", intent.property_id)
    .eq("owner_id", owner.user_id)
    .maybeSingle();
  if (!property) return fail(intent.intent, "NOT_FOUND", "Property not found for this Slack user.");

  const space = intent.space_id
    ? await loadSpace(intent.space_id, intent.property_id, ctx)
    : await createSurfaceSpace(intent.property_id, intent.payload.surface_type, ctx);
  if (!space) return fail(intent.intent, "NOT_FOUND", "Space not found for property.");

  const { data: latest, error: latestErr } = await ctx.supabase
    .from("space_briefs")
    .select("version")
    .eq("space_id", space.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) return fail(intent.intent, "INTERNAL_ERROR", "Failed to load latest brief.", latestErr);

  const { data: brief, error } = await ctx.supabase
    .from("space_briefs")
    .insert({
      space_id: space.id,
      version: (latest?.version ?? 0) + 1,
      surface_type: intent.payload.surface_type,
      creative_answers: {
        creative_direction: intent.payload.creative_direction,
        references: intent.payload.designer_references.join(", "),
      },
      non_negotiables:
        intent.payload.non_negotiables.length > 0
          ? intent.payload.non_negotiables.join("\n")
          : null,
      category_moodboards: moodboardsFromRecord(intent.payload.category_moodboards),
    })
    .select("*")
    .single();
  if (error || !brief) return fail(intent.intent, "INTERNAL_ERROR", "Failed to create brief.", error);

  return ok(intent.intent, { space, brief });
}

async function triggerRender(
  intent: Extract<AgentIntent, { intent: "trigger_render" }>,
  ctx: HandlerContext,
): Promise<AgentHandlerResponse> {
  const owner = await resolveOwner(intent.user_slack_id, ctx);
  if (!owner) return fail(intent.intent, "NOT_FOUND", "No Studio user is linked to this Slack id.");

  const { data: brief } = await ctx.supabase
    .from("space_briefs")
    .select("id, space_id")
    .eq("id", intent.payload.brief_id)
    .maybeSingle();
  if (!brief) return fail(intent.intent, "NOT_FOUND", "Brief not found.");

  const ownsProperty = await propertyBelongsToOwner(intent.property_id, owner.user_id, ctx);
  if (!ownsProperty) return fail(intent.intent, "NOT_FOUND", "Property not found for this Slack user.");

  const briefSpace = await loadSpace(brief.space_id, intent.property_id, ctx);
  if (!briefSpace) return fail(intent.intent, "NOT_FOUND", "Brief is not scoped to the property.");

  const { data: photo } = await ctx.supabase
    .from("property_photos")
    .select("id, property_id")
    .eq("id", intent.payload.base_photo_id)
    .eq("property_id", intent.property_id)
    .maybeSingle();
  if (!photo) return fail(intent.intent, "NOT_FOUND", "Base photo not found for property.");

  const { data: render, error } = await ctx.supabase
    .from("renders")
    .insert({
      space_id: brief.space_id,
      base_photo_id: photo.id,
      room_spec_id: null,
      prompt_text: "",
      status: "pending",
    })
    .select("id, space_id, base_photo_id, status, created_at")
    .single();
  if (error || !render) return fail(intent.intent, "INTERNAL_ERROR", "Failed to trigger render.", error);

  return ok(intent.intent, { render });
}

async function approveRender(
  intent: Extract<AgentIntent, { intent: "approve_render" }>,
  ctx: HandlerContext,
): Promise<AgentHandlerResponse> {
  const owner = await resolveOwner(intent.user_slack_id, ctx);
  if (!owner) return fail(intent.intent, "NOT_FOUND", "No Studio user is linked to this Slack id.");

  const { data: render, error } = await ctx.supabase
    .from("renders")
    .select("id, space_id")
    .eq("id", intent.payload.render_id)
    .maybeSingle();
  if (error) return fail(intent.intent, "INTERNAL_ERROR", "Failed to load render.", error);
  if (!render) return fail(intent.intent, "NOT_FOUND", "Render not found.");

  const renderOwned = await spaceBelongsToOwner(render.space_id, owner.user_id, ctx);
  if (!renderOwned) return fail(intent.intent, "NOT_FOUND", "Render not found for this Slack user.");

  const { data: approved, error: updateError } = await ctx.supabase
    .from("renders")
    .update({
      opus_verdict: "ship_it",
      approved_at: new Date().toISOString(),
      approval_rationale: intent.payload.approval_rationale,
    })
    .eq("id", intent.payload.render_id)
    .select("*")
    .maybeSingle();
  if (updateError) return fail(intent.intent, "INTERNAL_ERROR", "Failed to approve render.", updateError);
  if (!approved) return fail(intent.intent, "NOT_FOUND", "Render not found.");

  return ok(intent.intent, { render: approved });
}

async function attachReference(
  intent: Extract<AgentIntent, { intent: "attach_reference" }>,
  ctx: HandlerContext,
): Promise<AgentHandlerResponse> {
  const owner = await resolveOwner(intent.user_slack_id, ctx);
  if (!owner) return fail(intent.intent, "NOT_FOUND", "No Studio user is linked to this Slack id.");

  const { data: brief } = await ctx.supabase
    .from("space_briefs")
    .select("id, space_id")
    .eq("id", intent.payload.brief_id)
    .maybeSingle();
  if (!brief) return fail(intent.intent, "NOT_FOUND", "Brief not found.");

  const briefOwned = await spaceBelongsToOwner(brief.space_id, owner.user_id, ctx);
  if (!briefOwned) return fail(intent.intent, "NOT_FOUND", "Brief not found for this Slack user.");

  const { data: reference, error } = await ctx.supabase
    .from("brief_references")
    .insert({
      brief_id: brief.id,
      image_url_or_blob: intent.payload.image_url_or_blob,
      category: intent.payload.category,
      source_url: intent.payload.source_url ?? null,
      classification_notes: intent.payload.classification_notes ?? null,
    })
    .select("*")
    .single();
  if (error || !reference) {
    return fail(intent.intent, "INTERNAL_ERROR", "Failed to attach reference.", error);
  }

  return ok(intent.intent, { reference });
}

async function resolveOwner(userSlackId: string, ctx: HandlerContext) {
  const { data, error } = await ctx.supabase
    .from("agent_user_links")
    .select("user_slack_id, user_id")
    .eq("user_slack_id", userSlackId)
    .maybeSingle();
  if (error) {
    logAgent(ctx, { intent: "create_property", user_slack_id: userSlackId } as AgentIntent, "owner_lookup_error", error);
    return null;
  }
  return data;
}

async function loadSpace(spaceId: string, propertyId: string, ctx: HandlerContext) {
  const { data } = await ctx.supabase
    .from("spaces")
    .select("id, property_id, space_type, label")
    .eq("id", spaceId)
    .eq("property_id", propertyId)
    .maybeSingle();
  return data;
}

async function propertyBelongsToOwner(propertyId: string, ownerId: string, ctx: HandlerContext) {
  const { data } = await ctx.supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  return Boolean(data);
}

async function spaceBelongsToOwner(spaceId: string, ownerId: string, ctx: HandlerContext) {
  const { data: space } = await ctx.supabase
    .from("spaces")
    .select("id, property_id")
    .eq("id", spaceId)
    .maybeSingle();
  if (!space) return false;
  return propertyBelongsToOwner(space.property_id, ownerId, ctx);
}

async function createSurfaceSpace(propertyId: string, surfaceType: SurfaceType, ctx: HandlerContext) {
  const spaceType = surfaceType === "interior_room" ? "kitchen" : surfaceType;
  const label = surfaceType === "interior_room" ? "Interior Room" : surfaceType.replace(/_/g, " ");
  const { data } = await ctx.supabase
    .from("spaces")
    .insert({ property_id: propertyId, space_type: spaceType, label })
    .select("id, property_id, space_type, label")
    .single();
  return data;
}

function moodboardsFromRecord(record: Record<string, unknown> | undefined) {
  if (!record) return [];
  return Object.entries(record).map(([key, value]) => {
    const obj = isRecord(value) ? value : {};
    const imagePaths = Array.isArray(obj.image_storage_paths)
      ? obj.image_storage_paths.filter((x): x is string => typeof x === "string")
      : [];
    return {
      category_key: key,
      category_label: typeof obj.category_label === "string" ? obj.category_label : key,
      image_storage_paths: imagePaths,
      notes: typeof obj.notes === "string" ? obj.notes : null,
    };
  });
}

function parseAddress(payload: {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
}): { street: string; city: string; state: string; zip: string } | null {
  if (payload.city && payload.state && payload.zip) {
    return {
      street: payload.address,
      city: payload.city,
      state: payload.state.toUpperCase(),
      zip: payload.zip,
    };
  }

  const match = payload.address.match(/^(.*?),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!match) return null;
  return {
    street: match[1].trim(),
    city: match[2].trim(),
    state: match[3].toUpperCase(),
    zip: match[4],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ok(intent: AgentIntent["intent"], result: unknown): AgentHandlerResponse {
  return { ok: true, intent, result };
}

function fail(
  intent: AgentIntent["intent"],
  code: AgentErrorCode,
  message: string,
  details?: unknown,
): AgentHandlerResponse {
  return { ok: false, intent, error: { code, message, details } };
}

function logAgent(
  ctx: HandlerContext,
  intent: AgentIntent,
  event: string,
  details?: unknown,
): void {
  console.log("[agent_intent]", {
    request_id: ctx.requestId,
    event,
    intent: intent.intent,
    user_slack_id: intent.user_slack_id,
    property_id: "property_id" in intent ? intent.property_id : undefined,
    details,
  });
}
