/**
 * Disk-backed embedding cache, keyed by sha256(model + dims + chunk text).
 *
 * Why this is the single highest-value ingest optimization: embedding is
 * 90-95% of ingest wall time (measured: ACS150 172pp = 73s total, of which
 * ~68s is embedding), and it is gated by an API token-per-minute budget that
 * no amount of concurrency can beat. The only ways to go faster are to embed
 * fewer tokens or to not embed at all. This does the latter for anything
 * already seen.
 *
 * Hits are exact-text, so this is lossless -- a cached vector is byte-identical
 * to what the API would return for that text with that model. Re-ingesting a
 * manual (or ingesting a revised edition that shares most of its pages)
 * becomes near-instant.
 *
 * Keyed on model+dims as well as text so switching embedding providers or
 * dimensions can never silently mix incompatible vector spaces.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { dirname } from "node:path";

interface Persisted {
  version: 1;
  model: string;
  dims: number;
  entries: Record<string, number[]>;
}

export class EmbedCache {
  private path: string;
  private model: string;
  private dims: number;
  private entries = new Map<string, number[]>();
  private dirty = 0;

  constructor(path: string, model: string, dims: number) {
    this.path = path;
    this.model = model;
    this.dims = dims;
    this.load();
  }

  private key(text: string): string {
    return createHash("sha256").update(`${this.model}:${this.dims}:${text}`).digest("hex");
  }

  private load(): void {
    if (!existsSync(this.path)) return;
    try {
      const raw = JSON.parse(readFileSync(this.path, "utf8")) as Persisted;
      // A cache built for a different model/dims is not reusable -- drop it
      // rather than serve vectors from the wrong space.
      if (raw.version !== 1 || raw.model !== this.model || raw.dims !== this.dims) return;
      for (const [k, v] of Object.entries(raw.entries ?? {})) this.entries.set(k, v);
    } catch {
      /* a corrupt cache is not worth failing an ingest over -- start empty */
    }
  }

  get(text: string): number[] | undefined {
    return this.entries.get(this.key(text));
  }

  set(text: string, vector: number[]): void {
    this.entries.set(this.key(text), vector);
    this.dirty++;
  }

  get size(): number {
    return this.entries.size;
  }

  /** Written via temp+rename so a crash mid-write can't leave a truncated cache. */
  save(): void {
    if (!this.dirty) return;
    const payload: Persisted = {
      version: 1,
      model: this.model,
      dims: this.dims,
      entries: Object.fromEntries(this.entries),
    };
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(payload));
    renameSync(tmp, this.path);
    this.dirty = 0;
  }
}

/**
 * Embed with cache + duplicate collapsing.
 *
 * Two independent savings, both lossless:
 *   - cache hits skip the API entirely
 *   - identical chunk texts within one document are embedded ONCE and the
 *     vector reused (measured 11.6% exact duplicates on a real 456-page
 *     manual -- boilerplate blocks, repeated warnings, reprinted tables)
 */
export async function embedWithCache(
  texts: string[],
  cache: EmbedCache | undefined,
  embedMany: (inputs: string[], onProgress?: (done: number, total: number) => void) => Promise<number[][]>,
  onProgress?: (done: number, total: number) => void,
): Promise<{ vectors: number[][]; cacheHits: number; embedded: number }> {
  const out: number[][] = new Array(texts.length);
  const missIndexByText = new Map<string, number[]>();
  let cacheHits = 0;

  texts.forEach((text, i) => {
    const cached = cache?.get(text);
    if (cached) {
      out[i] = cached;
      cacheHits++;
      return;
    }
    const existing = missIndexByText.get(text);
    if (existing) existing.push(i);
    else missIndexByText.set(text, [i]);
  });

  const uniqueMisses = [...missIndexByText.keys()];
  if (uniqueMisses.length) {
    const alreadyDone = texts.length - uniqueMisses.length;
    const vectors = await embedMany(uniqueMisses, (done, total) =>
      // Report progress over the WHOLE input, not just the misses, so a
      // mostly-cached ingest doesn't look like it restarted from 0%.
      onProgress?.(Math.min(alreadyDone + done, texts.length), texts.length),
    );
    uniqueMisses.forEach((text, u) => {
      const vector = vectors[u];
      cache?.set(text, vector);
      for (const i of missIndexByText.get(text)!) out[i] = vector;
    });
  }

  onProgress?.(texts.length, texts.length);
  cache?.save();
  return { vectors: out, cacheHits, embedded: uniqueMisses.length };
}
