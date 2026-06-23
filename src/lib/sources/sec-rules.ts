import { fetchRss } from './rss';
import type { RawItem, Source } from './types';

// SEC exposes a proposed-rules RSS feed but NO final-rules feed; final-rule
// adoptions are announced through press releases. So we merge both: proposed
// rules + press releases. The Haiku gate filters press releases down to the
// ones that are actual mandates (rule adoptions), rejecting enforcement and
// personnel announcements.
const FEEDS = [
  'https://www.sec.gov/rss/rules/proposed.xml',
  'https://www.sec.gov/news/pressreleases.rss',
];

export const secRules: Source = {
  id: 'sec-rules',
  async fetch(): Promise<RawItem[]> {
    const settled = await Promise.allSettled(
      FEEDS.map((url) => fetchRss({ source: 'sec-rules', url })),
    );
    const items: RawItem[] = [];
    for (const [i, r] of settled.entries()) {
      if (r.status === 'fulfilled') items.push(...r.value);
      else
        console.error(
          `[sec-rules] feed failed ${FEEDS[i]}: ${(r.reason as Error)?.message}`,
        );
    }
    return items;
  },
};
