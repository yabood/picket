import { and, desc, isNotNull, isNull, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { mandates, runs, type Mandate, type Run } from '@/lib/db/schema';

export type MandateStatus = 'all' | 'posted' | 'rejected' | 'pending';

export async function getRecentRuns(limit = 5): Promise<Run[]> {
  return db.select().from(runs).orderBy(desc(runs.startedAt)).limit(limit);
}

export interface MandatesPage {
  rows: Mandate[];
  total: number;
  page: number;
  pageSize: number;
  status: MandateStatus;
}

function statusFilter(status: MandateStatus) {
  if (status === 'posted') return isNotNull(mandates.postedAt);
  if (status === 'rejected') return isNotNull(mandates.rejectedReason);
  if (status === 'pending')
    return and(isNull(mandates.postedAt), isNull(mandates.rejectedReason));
  return undefined;
}

export async function getMandatesPage(
  opts: { page?: number; pageSize?: number; status?: MandateStatus } = {},
): Promise<MandatesPage> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
  const status: MandateStatus = opts.status ?? 'all';
  const where = statusFilter(status);

  const rowsQuery = db
    .select()
    .from(mandates)
    .orderBy(desc(mandates.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countQuery = db.select({ n: sql<number>`count(*)::int` }).from(mandates);

  const [rows, totalResult] = await Promise.all([
    where ? rowsQuery.where(where) : rowsQuery,
    where ? countQuery.where(where) : countQuery,
  ]);

  return {
    rows,
    total: Number(totalResult[0]?.n ?? 0),
    page,
    pageSize,
    status,
  };
}

export interface RunsPage {
  rows: Run[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getRunsPage(
  opts: { page?: number; pageSize?: number } = {},
): Promise<RunsPage> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 5));

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(runs)
      .orderBy(desc(runs.startedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(runs),
  ]);

  return { rows, total: Number(totalResult[0]?.n ?? 0), page, pageSize };
}

export interface MandateCounts {
  total: number;
  posted: number;
  rejected: number;
  pending: number;
}

export async function getMandateCounts(): Promise<MandateCounts> {
  const counts = await db
    .select({
      total: sql<number>`count(*)::int`,
      posted: sql<number>`count(*) filter (where ${mandates.postedAt} is not null)::int`,
      rejected: sql<number>`count(*) filter (where ${mandates.rejectedReason} is not null)::int`,
      pending: sql<number>`count(*) filter (where ${mandates.postedAt} is null and ${mandates.rejectedReason} is null)::int`,
    })
    .from(mandates);

  const c = counts[0] ?? { total: 0, posted: 0, rejected: 0, pending: 0 };
  return {
    total: Number(c.total),
    posted: Number(c.posted),
    rejected: Number(c.rejected),
    pending: Number(c.pending),
  };
}

export async function getStatusSnapshot(): Promise<{
  lastRuns: Run[];
  mandateCounts: MandateCounts;
}> {
  const [lastRuns, mandateCounts] = await Promise.all([
    getRecentRuns(5),
    getMandateCounts(),
  ]);
  return { lastRuns, mandateCounts };
}
