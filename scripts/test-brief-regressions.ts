import { readFileSync } from "node:fs";
import { summarizeBriefForPrompt } from "../lib/briefs/prompt-input";
import { vincentAveFacadePromptInput } from "../test-fixtures/vincent-ave-facade";
import { buildSpaceBriefSavePayload } from "../lib/briefs/save-payload";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

function testExteriorPayloadKeepsSurfaceType() {
  const payload = buildSpaceBriefSavePayload({
    spaceType: "facade",
    initialSurfaceType: "facade",
    creativeAnswers: { creative_direction: "Warm restored bungalow facade." },
    nonNegotiables: "",
    categories: [],
    tiles: {},
  });

  assert(payload.surface_type === "facade", "exterior brief save payload should include facade surface_type");
}

function testExteriorCreativeDirectionAppearsOnce() {
  const summary = summarizeBriefForPrompt(vincentAveFacadePromptInput);

  assert(
    countOccurrences(summary, "Respect the bungalow bones") === 1,
    "exterior creative_direction should appear once in prompt summary",
  );
}

function testAgentServiceCanWriteProjectThemes() {
  const migration = readFileSync("supabase/migrations/0007_agent_service_role.sql", "utf8");

  assert(
    /grant insert, update on[\s\S]*project_themes[\s\S]*to agent_service;/m.test(migration),
    "agent_service insert/update grant should include project_themes",
  );
  assert(
    /project_themes_agent_rw[\s\S]*for all to agent_service[\s\S]*with check \(true\);/m.test(migration),
    "project_themes should have an agent read/write RLS policy",
  );
}

function main() {
  testExteriorPayloadKeepsSurfaceType();
  testExteriorCreativeDirectionAppearsOnce();
  testAgentServiceCanWriteProjectThemes();
  console.log("ok brief regressions");
}

main();
