/**
 * Loads the hallucination-control skill file and caches it in memory for the
 * life of the server process. This is what makes hallucination-skill.md a
 * real system prompt rather than documentation nobody reads — it's read once
 * and sent verbatim as the Groq `system` message on every /api/chat request.
 *
 * Falls back to an embedded copy if the file can't be read (a serverless
 * bundle that didn't trace the .md asset, a path resolution mismatch across
 * environments). The fallback is a genuine condensed version of the same
 * rules, not a placeholder — a missing system prompt on every request would
 * be a much worse failure than a shorter one.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let cached: string | null = null;

/**
 * The skill file is sent on EVERY request, and Groq's free tier caps this
 * account at 8,000 tokens per minute and 200,000 per day. Measured against
 * Groq's own `prompt_tokens`, the file costs ~3,000 of those 8,000 before a
 * single line of manual text is added -- which is why only about one query per
 * minute was getting through.
 *
 * So the file has two audiences and only one of them is billed. Whoever
 * maintains it needs the rationale: why a rule exists, which stage enforces
 * it, what broke without it. The model needs the imperative rule and nothing
 * else. Passages that exist purely to explain are wrapped in
 * `<!-- prompt:skip -->` / `<!-- /prompt:skip -->` and dropped here, along with
 * ordinary HTML comments.
 *
 * This keeps hallucination-skill.md the single source of truth -- there is no
 * second, silently diverging "short version" to maintain -- while cutting what
 * each request actually pays for.
 */
function forPrompt(markdown: string): string {
  return markdown
    .replace(/<!--\s*prompt:skip\s*-->[\s\S]*?<!--\s*\/prompt:skip\s*-->/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    // Collapse the blank lines the removals leave behind.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getHallucinationSkill(): string {
  if (cached) return cached;
  try {
    cached = forPrompt(
      readFileSync(path.join(process.cwd(), "lib/prompts/hallucination-skill.md"), "utf8"),
    );
  } catch (err) {
    console.warn(
      "[skill] could not read hallucination-skill.md, using embedded fallback:",
      String(err).slice(0, 150),
    );
    cached = FALLBACK_SKILL;
  }
  return cached;
}

const FALLBACK_SKILL = `You are FaultFinder's troubleshooting assistant. A technician relies on your
answer for a real machine. Every claim you make must be traceable to a
numbered excerpt [S#] you were given -- never fill a gap with what sounds
plausible, never invent a numeric value (voltage, torque, current, part
number), never complete a partial procedure from general knowledge, never
invent a page number or citation (citations are resolved programmatically
from used_sources, not from text you write). If the excerpts don't answer
the question, say so specifically in refusals rather than guessing -- name
what's missing, don't just say "not enough information."

Never resolve cross-machine ambiguity yourself; a genuinely ambiguous query
should already have been intercepted before reaching you. If conversation
history is present, treat it as context for interpreting THIS question, not
as a source of factual claims -- re-ground every claim in the current
excerpts, and let an explicit machine named in the current message override
one established earlier.

A [Figure]-marked source is a diagram; when you cite one in used_sources its
image renders separately below your answer -- describe what it shows, never
say it "cannot be shown."

Respond with JSON only:
{"error_code":"","meaning":"","probable_causes":[],"corrective_action":[{"step":1,"action":""}],"used_sources":[1,2],"confidence":"high|medium|low","refusals":[]}`;
