import { and, isNull, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { mandates, runs } from '@/lib/db/schema';
import type { Brief } from '@/lib/extract';
import type { Gate } from '@/lib/gate';
import type { RawItem } from '@/lib/sources';

import { keysFor } from './dedupe-key';

export interface InsertedMandate {
  id: string;
  dedupeKey: string;
}

export interface PendingMandate {
  mandateId: string;
  item: RawItem;
}

/**
 * Insert a row for this item. If a row with the same dedupe key already exists,
 * return null — caller should skip processing.
 */
export async function insertIfNew(item: RawItem): Promise<InsertedMandate | null> {
  const { dedupeKey, contentHash } = keysFor(item);
  const result = await db
    .insert(mandates)
    .values({
      dedupeKey,
      source: item.source,
      externalId: item.externalId,
      url: item.url,
      title: item.title,
      body: item.body,
      contentHash,
      publishedAt: item.publishedAt,
      rawPayload: item.raw as object,
    })
    .onConflictDoNothing({ target: mandates.dedupeKey })
    .returning({ id: mandates.id, dedupeKey: mandates.dedupeKey });

  const inserted = result[0];
  return inserted ? { id: inserted.id, dedupeKey: inserted.dedupeKey } : null;
}

/**
 * Terminal: brief delivered to Slack. Writes gate + brief + posted_at. Once
 * gate is non-null the row leaves the pending set, so re-runs never re-post.
 */
export async function markPosted(
  mandateId: string,
  gate: Gate,
  brief: Brief,
  destination: string,
): Promise<void> {
  await db
    .update(mandates)
    .set({
      gate: gate as unknown as object,
      brief: brief as unknown as object,
      slackTs: destination,
      postedAt: new Date(),
    })
    .where(sql`${mandates.id} = ${mandateId}`);
}

/** Terminal: failed the gate or post-gate filter. Writes gate + reason. */
export async function markRejected(
  mandateId: string,
  gate: Gate,
  reason: string,
): Promise<void> {
  await db
    .update(mandates)
    .set({
      gate: gate as unknown as object,
      rejectedReason: reason,
    })
    .where(sql`${mandates.id} = ${mandateId}`);
}

/**
 * Rows persisted in a prior tick that never reached a terminal state — gate
 * IS NULL (gate/extract/post errored transiently, or a crash mid-tick) and not
 * rejected. The next tick re-gates and re-processes them. Gate/brief are only
 * written at a terminal state, so a transient failure always leaves the row
 * here for retry.
 */
export async function loadPending(limit = 500): Promise<PendingMandate[]> {
  const rows = await db
    .select({
      id: mandates.id,
      source: mandates.source,
      externalId: mandates.externalId,
      url: mandates.url,
      title: mandates.title,
      body: mandates.body,
      publishedAt: mandates.publishedAt,
      rawPayload: mandates.rawPayload,
    })
    .from(mandates)
    .where(and(isNull(mandates.gate), isNull(mandates.rejectedReason)))
    .limit(limit);

  return rows.map((r) => ({
    mandateId: r.id,
    item: {
      source: r.source,
      externalId: r.externalId,
      url: r.url,
      title: r.title ?? '',
      body: r.body ?? '',
      publishedAt: r.publishedAt,
      raw: r.rawPayload,
    },
  }));
}

export interface RunCounters {
  fetched: number;
  deduped: number;
  gated: number;
  accepted: number;
  extracted: number;
  posted: number;
  errors: number;
}

export interface RunRecorder {
  id: string;
  finish(counters: RunCounters, error?: string): Promise<void>;
}

export async function beginRun(): Promise<RunRecorder> {
  const result = await db.insert(runs).values({}).returning({ id: runs.id });
  const id = result[0]!.id;

  return {
    id,
    async finish(counters, error) {
      await db
        .update(runs)
        .set({
          finishedAt: new Date(),
          fetched: counters.fetched,
          deduped: counters.deduped,
          gated: counters.gated,
          accepted: counters.accepted,
          extracted: counters.extracted,
          posted: counters.posted,
          errors: counters.errors,
          error: error ?? null,
        })
        .where(sql`${runs.id} = ${id}`);
    },
  };
}
