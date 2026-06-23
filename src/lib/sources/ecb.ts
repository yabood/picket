import { fetchRss } from './rss';
import type { Source } from './types';

// ECB Banking Supervision press feed — closer to DORA / operational-resilience
// obligations for supervised banks than the general ECB monetary-policy press.
export const ecb: Source = {
  id: 'ecb',
  fetch: () =>
    fetchRss({
      source: 'ecb',
      url: 'https://www.bankingsupervision.europa.eu/rss/press.xml',
    }),
};
