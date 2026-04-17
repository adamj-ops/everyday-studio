import Anthropic from "@anthropic-ai/sdk";

/**
 * Two-tier Claude architecture:
 *
 *   Sonnet is the operator — fast, cheap, follows structured rubrics.
 *   Opus is the reviewer — higher reasoning, better vision, verification-tuned.
 *
 * Model routing is role-based, not task-based (see CLAUDE.md Rules). Don't
 * upgrade a generator to Opus for quality — improve the prompt first. Don't
 * downgrade a reviewer to Sonnet for cost — the reviewer's stakes justify it.
 *
 * IDs below use the "undated" form because that's how Anthropic ships Sonnet
 * 4.6 and Opus 4.7 in their public model list (see
 * docs.anthropic.com/en/docs/about-claude/models/all-models). These are stable
 * strings for these versions; Anthropic uses dated suffixes for 4.5-and-older
 * models only.
 */

// Sonnet: the operator. Used for prompt generation, field suggestions,
// and any other high-frequency generation call.
export const CLAUDE_OPERATOR_MODEL =
  process.env.CLAUDE_OPERATOR_MODEL ?? "claude-sonnet-4-6";

// Opus: the reviewer. Used for prompt review before rendering and for
// render QA after rendering. Opus gatekeeps anything visual that ships
// to a designer or contractor.
export const CLAUDE_REVIEWER_MODEL =
  process.env.CLAUDE_REVIEWER_MODEL ?? "claude-opus-4-7";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY is not set. Add it to .env.local (scripts) or to the deployment environment (Next.js server).",
  );
}

export const anthropicClient = new Anthropic({ apiKey });
