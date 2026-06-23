import type { Brief } from '@/lib/extract';
import type { Gate } from '@/lib/gate';
import type { RawItem } from '@/lib/sources';

export interface Citation {
  label: string;
  url: string;
}

export interface Deadline {
  description: string;
  date: string | null;
}

export interface Notification {
  regulator: string;
  instrument: string;
  jurisdiction: string;
  status: string;
  changeType: string;
  whatChanged: string;
  whoIsAffected: string[];
  requirements: string[];
  effectiveDate: string | null;
  deadlines: Deadline[];
  relevanceArea: string;
  notableQuote: string | null;
  citations: Citation[];
  source: string;
  url: string | null;
  confidence: number;
  occurredAt: Date;
}

/** Ensure the item's own URL is the first citation, then dedupe by URL. */
function withItemUrl(itemUrl: string | null, citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  if (itemUrl) {
    out.push({ label: 'Source', url: itemUrl });
    seen.add(itemUrl);
  }
  for (const c of citations) {
    if (!c.url || seen.has(c.url)) continue;
    seen.add(c.url);
    out.push(c);
  }
  return out;
}

export function buildNotification(
  item: RawItem,
  g: Gate,
  brief: Brief,
): Notification {
  return {
    regulator: brief.regulator || g.regulator || item.source,
    instrument: brief.instrument || item.title,
    jurisdiction: brief.jurisdiction || g.jurisdiction || '—',
    status: brief.status || '—',
    changeType: brief.changeType,
    whatChanged: brief.whatChanged,
    whoIsAffected: brief.whoIsAffected,
    requirements: brief.requirements,
    effectiveDate: brief.effectiveDate,
    deadlines: brief.deadlines,
    relevanceArea: brief.relevanceArea || g.relevanceArea || '',
    notableQuote: brief.notableQuote,
    citations: withItemUrl(item.url, brief.citations),
    source: item.source,
    url: item.url,
    confidence: g.confidence,
    occurredAt: item.publishedAt ?? new Date(),
  };
}
