import { extract, type Brief } from '@/lib/extract';
import { gate, type Gate } from '@/lib/gate';
import {
  buildNotification,
  createDefaultSink,
  type NotificationSink,
} from '@/lib/notify';
import {
  fetchPdfText,
  fetchReadable,
  isPdfUrl,
  sources,
  type RawItem,
} from '@/lib/sources';

import {
  beginRun,
  insertIfNew,
  loadPending,
  markPosted,
  markRejected,
  type RunCounters,
} from './persist';

const GATE_CONCURRENCY = 5;
// 30 days — wide enough to backfill recent history on a cold start. Re-runs
// stay idempotent (dedupe key), so a seen item is never re-gated or re-posted.
const MAX_ITEM_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_HYDRATED_BODY = 16_000;

interface PollDeps {
  sink?: NotificationSink;
}

export interface PollResult {
  runId: string;
  counters: RunCounters;
  durationMs: number;
  pendingPickedUp: number;
}

/** Post-gate filter — which gate verdicts proceed to extraction. */
function filterReason(g: Gate): string | null {
  if (!g.isMandate) return `not-a-mandate (conf=${g.confidence.toFixed(2)})`;
  if (!g.imposesNewObligation) return 'no-new-obligation';
  if (!g.relevantToElastio) return 'not-relevant-to-elastio';
  if (g.confidence < 0.7) return `low-confidence=${g.confidence.toFixed(2)}`;
  return null;
}

/**
 * For gate-passers, fetch fuller source text so extraction has more than an RSS
 * snippet to work with. CISA directives already carry full readable text.
 * Failures are non-fatal — we fall back to the original (snippet) body.
 */
async function hydrate(item: RawItem): Promise<RawItem> {
  if (item.source === 'cisa-directives' || !item.url) return item;
  try {
    const text = isPdfUrl(item.url)
      ? await fetchPdfText(item.url)
      : (await fetchReadable(item.url)).text;
    if (text && text.length > item.body.length) {
      return { ...item, body: text.slice(0, MAX_HYDRATED_BODY) };
    }
  } catch (err) {
    console.error(`[poll] hydrate failed for ${item.url}: ${(err as Error).message}`);
  }
  return item;
}

async function fetchAllSources(): Promise<{ items: RawItem[]; errors: number }> {
  const settled = await Promise.allSettled(sources.map((s) => s.fetch()));
  const items: RawItem[] = [];
  let errors = 0;
  for (const [i, r] of settled.entries()) {
    if (r.status === 'fulfilled') items.push(...r.value);
    else {
      errors++;
      console.error(`[poll] source ${sources[i]?.id} failed:`, r.reason);
    }
  }
  return { items, errors };
}

async function workerPool<T>(
  items: T[],
  concurrency: number,
  work: (item: T) => Promise<void>,
) {
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      await work(items[i]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
}

export async function pollOnce(deps: PollDeps = {}): Promise<PollResult> {
  const startedAt = Date.now();
  const run = await beginRun();
  const counters: RunCounters = {
    fetched: 0,
    deduped: 0,
    gated: 0,
    accepted: 0,
    extracted: 0,
    posted: 0,
    errors: 0,
  };

  const sink = deps.sink ?? createDefaultSink();
  let pendingPickedUp = 0;

  try {
    // 1. Self-healing — pick up rows persisted in a prior tick that never
    // reached a terminal state. MUST run before insertIfNew so the rows we're
    // about to insert (also gate IS NULL) aren't double-loaded this tick.
    const pending = await loadPending();
    pendingPickedUp = pending.length;

    // 2. Fetch all sources.
    const fetched = await fetchAllSources();
    counters.fetched = fetched.items.length;
    counters.errors += fetched.errors;

    // Drop items older than the cutoff so a cold first-run doesn't spray months
    // of history. Items with no publishedAt (e.g. CISA directive pages) are
    // kept — better to let the gate judge than silently lose a mandate.
    const cutoff = Date.now() - MAX_ITEM_AGE_MS;
    const fresh = fetched.items.filter(
      (i) => !i.publishedAt || i.publishedAt.getTime() >= cutoff,
    );

    // 3. DB-level dedupe → keep only newly-persisted items.
    const newItems: Array<{ item: RawItem; mandateId: string }> = [];
    for (const item of fresh) {
      try {
        const inserted = await insertIfNew(item);
        if (inserted) newItems.push({ item, mandateId: inserted.id });
        else counters.deduped++;
      } catch (err) {
        counters.errors++;
        console.error(
          `[poll] insertIfNew failed for ${item.source}:${item.externalId}`,
          err,
        );
      }
    }

    const work = [
      ...newItems,
      ...pending.map((p) => ({ item: p.item, mandateId: p.mandateId })),
    ];

    // 4. Gate → filter → hydrate → extract → post. Transient failures leave the
    // row pending (gate/brief only written at a terminal state) for next tick.
    await workerPool(work, GATE_CONCURRENCY, async ({ item, mandateId }) => {
      let g: Gate;
      try {
        g = await gate(item);
        counters.gated++;
      } catch (err) {
        counters.errors++;
        console.error(
          `[poll] gate failed for ${item.source}:${item.externalId} — left pending:`,
          (err as Error).message,
        );
        return;
      }

      const reject = filterReason(g);
      if (reject) {
        await markRejected(mandateId, g, reject).catch((err) => {
          counters.errors++;
          console.error('[poll] markRejected failed:', err);
        });
        return;
      }
      counters.accepted++;

      let brief: Brief;
      try {
        const hydrated = await hydrate(item);
        brief = await extract(hydrated, g);
        counters.extracted++;
      } catch (err) {
        counters.errors++;
        console.error(
          `[poll] extract failed for ${item.source}:${item.externalId} — left pending:`,
          (err as Error).message,
        );
        return;
      }

      try {
        const notification = buildNotification(item, g, brief);
        const sinkResult = await sink.send(notification);
        await markPosted(mandateId, g, brief, sinkResult.destination);
        counters.posted++;
      } catch (err) {
        counters.errors++;
        console.error('[poll] notify/markPosted failed:', err);
      }
    });

    await run.finish(counters);
    return {
      runId: run.id,
      counters,
      durationMs: Date.now() - startedAt,
      pendingPickedUp,
    };
  } catch (err) {
    await run.finish(counters, (err as Error).message);
    throw err;
  }
}
