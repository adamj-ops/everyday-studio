import { z } from "zod";
import { SurfaceTypeEnum } from "@/lib/briefs/schema";

export const AgentErrorCodeSchema = z.enum([
  "INVALID_PAYLOAD",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "RATE_LIMITED",
  "OPUS_REJECTED",
  "INTERNAL_ERROR",
]);
export type AgentErrorCode = z.infer<typeof AgentErrorCodeSchema>;

export const CreatePropertyIntent = z.object({
  intent: z.literal("create_property"),
  user_slack_id: z.string().min(1),
  payload: z.object({
    address: z.string().min(1),
    city: z.string().min(1).optional(),
    state: z.string().length(2).optional(),
    zip: z.string().min(5).max(10).optional(),
    brand: z.enum(["everyday", "bevs_garden_co"]),
    budget_tier: z.enum(["builder", "mid", "high", "luxury", "custom"]),
  }),
});

export const CreateBriefIntent = z.object({
  intent: z.literal("create_brief"),
  user_slack_id: z.string().min(1),
  property_id: z.string().uuid(),
  space_id: z.string().uuid().optional(),
  payload: z.object({
    surface_type: SurfaceTypeEnum,
    creative_direction: z.string().min(1),
    non_negotiables: z.array(z.string()).default([]),
    designer_references: z.array(z.string()).default([]),
    category_moodboards: z.record(z.unknown()).optional(),
  }),
});

export const TriggerRenderIntent = z.object({
  intent: z.literal("trigger_render"),
  user_slack_id: z.string().min(1),
  property_id: z.string().uuid(),
  payload: z.object({
    brief_id: z.string().uuid(),
    base_photo_id: z.string().uuid(),
    render_kind: z.enum(["designer_mockup"]).default("designer_mockup"),
  }),
});

export const ApproveRenderIntent = z.object({
  intent: z.literal("approve_render"),
  user_slack_id: z.string().min(1),
  payload: z.object({
    render_id: z.string().uuid(),
    approval_rationale: z.string().min(1),
  }),
});

export const AttachReferenceIntent = z.object({
  intent: z.literal("attach_reference"),
  user_slack_id: z.string().min(1),
  payload: z.object({
    brief_id: z.string().uuid(),
    image_url_or_blob: z.string().min(1),
    category: z.string().min(1),
    source_url: z.string().url().optional(),
    classification_notes: z.string().optional(),
  }),
});

export const AgentIntent = z.discriminatedUnion("intent", [
  CreatePropertyIntent,
  CreateBriefIntent,
  TriggerRenderIntent,
  ApproveRenderIntent,
  AttachReferenceIntent,
]);

export type AgentIntent = z.infer<typeof AgentIntent>;
export type AgentIntentName = AgentIntent["intent"];
