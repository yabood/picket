import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { pollOnce } from '@/lib/orchestrator/poll';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorized(authHeader: string | null): boolean {
  if (!authHeader) return false;
  const expected = `Bearer ${env.CRON_SECRET}`;
  // Constant-time-ish compare via length check then XOR accumulate.
  if (authHeader.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ authHeader.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await pollOnce();
    return NextResponse.json({
      ok: true,
      runId: result.runId,
      counters: result.counters,
      pendingPickedUp: result.pendingPickedUp,
      durationMs: result.durationMs,
    });
  } catch (err) {
    console.error('[cron/poll] failed:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

// Vercel Cron hits POST; allow GET for a manual sanity-check (still auth-gated).
export const GET = POST;
