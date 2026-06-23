import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * One row per fetched item (a regulator publication / directive / rule).
 *
 * Lifecycle (derived, not stored — mirrors Scout):
 *   - pending   : gate IS NULL  AND rejected_reason IS NULL  (detected, not yet processed)
 *   - rejected  : rejected_reason IS NOT NULL                (failed the gate or filter)
 *   - posted    : posted_at IS NOT NULL                      (brief delivered to Slack)
 *
 * `content_hash` (sha256 of the extracted body) feeds the dedupe key, so a
 * meaningful edit to a previously-seen page surfaces as a new row.
 */
export const mandates = pgTable(
  'mandates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dedupeKey: text('dedupe_key').notNull(),
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    url: text('url'),
    title: text('title'),
    body: text('body'),
    contentHash: text('content_hash'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    rawPayload: jsonb('raw_payload').notNull(),
    gate: jsonb('gate'),
    brief: jsonb('brief'),
    slackTs: text('slack_ts'),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    rejectedReason: text('rejected_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex('mandates_dedupe_key_idx').on(t.dedupeKey),
    index('mandates_posted_at_idx').on(t.postedAt),
    index('mandates_created_at_idx').on(t.createdAt),
    index('mandates_source_idx').on(t.source),
  ],
);

export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    fetched: integer('fetched').notNull().default(0),
    deduped: integer('deduped').notNull().default(0),
    gated: integer('gated').notNull().default(0),
    accepted: integer('accepted').notNull().default(0),
    extracted: integer('extracted').notNull().default(0),
    posted: integer('posted').notNull().default(0),
    errors: integer('errors').notNull().default(0),
    error: text('error'),
  },
  (t) => [index('runs_started_at_idx').on(t.startedAt)],
);

export type Mandate = typeof mandates.$inferSelect;
export type NewMandate = typeof mandates.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
