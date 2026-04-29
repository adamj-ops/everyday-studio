import { createClient } from "@supabase/supabase-js";

export function createAgentClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.STUDIO_AGENT_DB_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or STUDIO_AGENT_DB_KEY");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "everyday-studio-agent" } },
  });
}
