import { NextResponse } from "next/server";

/**
 * Log full error server-side; return a stable JSON body for clients.
 */
export function internalError(code: string, err: unknown): NextResponse {
  console.error(`[api:${code}]`, err);
  return NextResponse.json({ error: "internal_error", code }, { status: 500 });
}
