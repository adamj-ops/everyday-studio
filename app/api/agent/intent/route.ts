import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { AgentIntent, type AgentIntentName } from "@/lib/agent/intent-schema";
import { createAgentClient } from "@/lib/agent/client";
import { handleAgentIntent } from "@/lib/agent/handlers";
import { checkAgentRateLimit } from "@/lib/agent/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const expected = process.env.STUDIO_AGENT_API_KEY ?? "";

  if (!token || !expected || !safeTokenEqual(token, expected)) {
    return agentError(null, "UNAUTHORIZED", "Missing or invalid bearer token.", 401);
  }

  const tokenKey = createHash("sha256").update(token).digest("hex");
  const rate = checkAgentRateLimit(tokenKey);
  if (!rate.ok) {
    return agentError(null, "RATE_LIMITED", "Agent rate limit exceeded.", 429, {
      reset_at: new Date(rate.resetAt).toISOString(),
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = AgentIntent.safeParse(body);
  if (!parsed.success) {
    return agentError(null, "INVALID_PAYLOAD", "Invalid agent intent payload.", 400, parsed.error.flatten());
  }

  try {
    const supabase = createAgentClient();
    const result = await handleAgentIntent(parsed.data, { supabase, requestId });
    const status = result.ok ? 200 : statusForCode(result.error.code);
    return NextResponse.json(result, { status });
  } catch (err) {
    console.error("[agent_intent]", {
      request_id: requestId,
      event: "unhandled_error",
      error: err instanceof Error ? err.message : err,
    });
    return agentError(parsed.data.intent, "INTERNAL_ERROR", "Unhandled agent intent error.", 500);
  }
}

function agentError(
  intent: AgentIntentName | null,
  code: "INVALID_PAYLOAD" | "NOT_FOUND" | "UNAUTHORIZED" | "RATE_LIMITED" | "OPUS_REJECTED" | "INTERNAL_ERROR",
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    {
      ok: false,
      intent,
      error: { code, message, details },
    },
    { status },
  );
}

function statusForCode(code: string): number {
  if (code === "INVALID_PAYLOAD") return 400;
  if (code === "UNAUTHORIZED") return 401;
  if (code === "RATE_LIMITED") return 429;
  if (code === "NOT_FOUND") return 404;
  if (code === "OPUS_REJECTED") return 422;
  return 500;
}

function safeTokenEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
