import { fetchRss } from './rss';
import type { Source } from './types';

// CISA news releases. Deliberately NOT the per-CVE advisories feed
// (cybersecurity-advisories/all.xml, ~300KB of vulnerability bulletins) —
// Picket tracks mandates/policy, and news.xml is the low-volume, high-signal
// announcement feed where new directives and programs surface. Swap to the
// advisories feed if broader coverage is wanted.
export const cisaNews: Source = {
  id: 'cisa-news',
  fetch: () =>
    fetchRss({
      source: 'cisa-news',
      url: 'https://www.cisa.gov/news.xml',
    }),
};
