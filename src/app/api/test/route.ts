import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { extract } from '@/lib/extract';
import { gate } from '@/lib/gate';
import { buildNotification, toMarkdown, toSlackBlocks } from '@/lib/notify';
import { fetchReadable, type RawItem } from '@/lib/sources';
import { cisaDirectives } from '@/lib/sources/cisa-directives';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

function isAuthorized(authHeader: string | null): boolean {
  if (!authHeader) return false;
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (authHeader.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ authHeader.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Build a one-off item from an arbitrary URL, or fall back to a live CISA directive. */
async function resolveItem(url: string | null): Promise<RawItem> {
  if (url) {
    const doc = await fetchReadable(url);
    return {
      source: 'test',
      externalId: url,
      url,
      title: doc.title ?? url,
      body: doc.text.slice(0, 16_000),
      publishedAt: null,
      raw: { url },
    };
  }
  const items = await cisaDirectives.fetch();
  if (items.length === 0) throw new Error('No CISA directives available to test.');
  return items[0]!;
}

async function handle(request: Request) {
  if (!isAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let url: string | null = null;
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    url = typeof body?.url === 'string' ? body.url : null;
  } else {
    url = new URL(request.url).searchParams.get('url');
  }

  try {
    const item = await resolveItem(url);
    const g = await gate(item);
    const wouldAccept =
      g.isMandate && g.imposesNewObligation && g.relevantToElastio && g.confidence >= 0.7;

    // Extract regardless so the brief shape is visible during prompt iteration.
    const brief = await extract(item, g);
    const notification = buildNotification(item, g, brief);

    return NextResponse.json({
      ok: true,
      note: 'Test run. Nothing was persisted or posted to Slack.',
      item: { source: item.source, title: item.title, url: item.url },
      gate: g,
      wouldAccept,
      brief,
      preview: {
        markdown: toMarkdown(notification),
        slackBlocks: toSlackBlocks(notification),
      },
    });
  } catch (err) {
    console.error('[api/test] failed:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export const POST = handle;
export const GET = handle;
