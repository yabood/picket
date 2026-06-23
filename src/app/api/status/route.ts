import { NextResponse } from 'next/server';

import { getStatusSnapshot } from '@/lib/admin/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const snapshot = await getStatusSnapshot();
    return NextResponse.json({
      ok: true,
      mandateCounts: snapshot.mandateCounts,
      lastRuns: snapshot.lastRuns.map((r) => ({
        id: r.id,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        durationMs:
          r.finishedAt && r.startedAt
            ? r.finishedAt.getTime() - r.startedAt.getTime()
            : null,
        fetched: r.fetched,
        deduped: r.deduped,
        gated: r.gated,
        accepted: r.accepted,
        extracted: r.extracted,
        posted: r.posted,
        errors: r.errors,
        error: r.error,
      })),
    });
  } catch (err) {
    console.error('[api/status] failed:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
