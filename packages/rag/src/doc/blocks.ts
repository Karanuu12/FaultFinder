/**
 * Page text → typed blocks.
 *
 * The parser adapter gives us text per page (plus markdown tables, once
 * LlamaParse is wired in). This module recovers structure from it: headings,
 * markdown tables, numbered procedures, and warning boxes. Everything else
 * becomes a paragraph.
 *
 * Deliberately conservative. The original implementation called any short line
 * containing "error" or "cause" a heading, which meant body text in a fault
 * manual constantly reset the section — so sections were wrong everywhere.
 * Here a heading must be *numbered* or match a known structural label, or come
 * from the PDF outline (which is exact, and preferred when available).
 */
import type { Block, BlockKind, StepData, AdmonitionSeverity } from "./model.ts";
import { extractUnits } from "./model.ts";
import { parseMarkdownTable, isTableLine } from "./tables.ts";

export interface PageInput {
  /** 1-based physical page index. */
  page: number;
  text: string;
  /** Printed page label, when the parser recovered one. Defaults to the index. */
  pageLabel?: string;
  images?: string[];
}

export interface OutlineInput {
  title: string;
  pagePdf: number;
  level: number;
}

export interface BlockBuildOptions {
  documentId: string;
  /** PDF outline. When present it drives sectionPath exactly — no guessing. */
  outline?: OutlineInput[];
}

/** "4.1 Fault tracing", "7.1.2 Something" — numbering is the reliable signal. */
const NUMBERED_HEADING = /^(\d+(?:\.\d+){0,3})[.)]?\s+(\S.{0,88})$/;

/** Structural labels that are headings even without numbering. */
const LABEL_HEADING =
  /^(what this chapter contains|table of contents|fault tracing|diagnostics|troubleshooting|maintenance|safety|introduction|overview|probable causes?|corrective actions?|what to do|remedy|symptom)\s*:?\s*$/i;

const ADMONITION = /^(DANGER|WARNING|CAUTION|NOTICE|IMPORTANT|NOTE)\b[:!.\s-]*(.*)$/i;

const STEP_LINE = /^\s*(\d{1,2})[.)]\s+(\S.*)$/;

function severityFrom(word: string): AdmonitionSeverity {
  const w = word.toLowerCase();
  if (w === "danger") return "danger";
  if (w === "warning") return "warning";
  if (w === "caution") return "caution";
  return "notice";
}

/**
 * Section path from the PDF outline: the deepest bookmark at or before this page.
 * Exact, and free — every manual in this corpus ships one.
 */
function outlinePathFor(outline: OutlineInput[] | undefined, page: number): string[] {
  if (!outline?.length) return [];
  const stack: string[] = [];
  for (const entry of outline) {
    if (entry.pagePdf > page) break;
    stack.length = Math.max(0, entry.level);
    stack[entry.level] = entry.title.trim();
  }
  return stack.filter(Boolean);
}

export function buildBlocks(pages: PageInput[], opts: BlockBuildOptions): Block[] {
  const blocks: Block[] = [];
  let seq = 0;
  // Section path derived from in-page headings, used when there's no outline.
  let headingPath: string[] = [];

  const push = (
    kind: BlockKind,
    text: string,
    page: PageInput,
    extra: Partial<Block> = {},
  ): void => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const outlinePath = outlinePathFor(opts.outline, page.page);
    blocks.push({
      id: `${opts.documentId}-b${String(seq++).padStart(5, "0")}`,
      documentId: opts.documentId,
      kind,
      text: trimmed,
      pagePdf: page.page,
      pageLabel: page.pageLabel ?? String(page.page),
      sectionPath: outlinePath.length ? outlinePath : [...headingPath],
      level: extra.level ?? headingPath.length,
      textSource: "digital",
      units: extractUnits(trimmed),
      ...extra,
    });
  };

  for (const page of pages) {
    const lines = (page.text ?? "").split("\n");
    let paragraph: string[] = [];
    let tableLines: string[] = [];
    let steps: StepData[] = [];
    let stepPreamble = "";

    const flushParagraph = () => {
      if (paragraph.length) {
        push("para", paragraph.join("\n"), page);
        paragraph = [];
      }
    };

    const flushTable = () => {
      if (tableLines.length >= 2) {
        const table = parseMarkdownTable(tableLines.join("\n"));
        if (table) {
          push("table", table.markdown, page, { table });
        } else {
          push("para", tableLines.join("\n"), page);
        }
      } else if (tableLines.length) {
        paragraph.push(...tableLines);
      }
      tableLines = [];
    };

    const flushSteps = () => {
      if (steps.length) {
        push("steps", stepPreamble || "Procedure:", page, { steps: [...steps] });
        steps = [];
        stepPreamble = "";
      }
    };

    const flushAll = () => {
      flushTable();
      flushSteps();
      flushParagraph();
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();

      if (!trimmed) {
        flushTable();
        flushSteps();
        flushParagraph();
        continue;
      }

      // Markdown table rows accumulate until the run ends.
      if (isTableLine(trimmed) && trimmed.split("|").length >= 3) {
        flushSteps();
        flushParagraph();
        tableLines.push(trimmed);
        continue;
      }
      if (tableLines.length) flushTable();

      // Headings
      const numbered = trimmed.match(NUMBERED_HEADING);
      if (numbered && trimmed.length <= 90) {
        flushAll();
        const level = numbered[1].split(".").length - 1;
        headingPath = [...headingPath.slice(0, level), trimmed];
        push("heading", trimmed, page, { level });
        continue;
      }
      if (LABEL_HEADING.test(trimmed)) {
        flushAll();
        headingPath = [...headingPath.slice(0, 1), trimmed];
        push("heading", trimmed, page, { level: Math.max(0, headingPath.length - 1) });
        continue;
      }

      // Warning / caution boxes
      const adm = trimmed.match(ADMONITION);
      if (adm) {
        flushAll();
        const severity = severityFrom(adm[1]);
        const body = adm[2]?.trim() || adm[1];
        push("admonition", body, page, { admonition: { severity, text: body } });
        continue;
      }

      // Numbered procedure steps
      const step = trimmed.match(STEP_LINE);
      if (step) {
        flushTable();
        if (!steps.length) {
          // The line before the first step is the procedure's preamble.
          stepPreamble = paragraph.length ? paragraph[paragraph.length - 1] : "";
          if (paragraph.length) {
            paragraph.pop();
            flushParagraph();
          }
        }
        steps.push({ n: Number(step[1]), text: step[2].trim() });
        continue;
      }
      if (steps.length) {
        // A non-step line ends the procedure, unless it's an obvious continuation.
        if (/^[a-z(]/.test(trimmed) && steps.length) {
          steps[steps.length - 1].text += ` ${trimmed}`;
          continue;
        }
        flushSteps();
      }

      paragraph.push(trimmed);
    }

    flushAll();

    // Figures: one block per page image, so captions can be attached later.
    (page.images ?? []).forEach((href, i) => {
      push("figure", `[Figure p${page.page}-${i + 1}]`, page, {
        figure: { figureId: `${opts.documentId}-p${page.page}-f${i + 1}`, href },
      });
    });
  }

  return blocks;
}
