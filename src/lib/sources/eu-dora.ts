import { fetchRss } from './rss';
import type { RawItem, Source } from './types';

// DORA's technical standards (RTS/ITS) come from the European Supervisory
// Authorities. EBA and ESMA publish general news/publication RSS feeds;
// EIOPA has no working RSS as of build time. The gate filters these broad
// feeds down to DORA / ICT / operational-resilience items.
const FEEDS = [
  'https://www.eba.europa.eu/rss.xml',
  'https://www.esma.europa.eu/rss.xml',
];

export const euDora: Source = {
  id: 'eu-dora',
  async fetch(): Promise<RawItem[]> {
    const settled = await Promise.allSettled(
      FEEDS.map((url) => fetchRss({ source: 'eu-dora', url })),
    );
    const items: RawItem[] = [];
    for (const [i, r] of settled.entries()) {
      if (r.status === 'fulfilled') items.push(...r.value);
      else
        console.error(
          `[eu-dora] feed failed ${FEEDS[i]}: ${(r.reason as Error)?.message}`,
        );
    }
    return items;
  },
};
