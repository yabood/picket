import Parser from 'rss-parser';

import type { RawItem } from './types';

const parser = new Parser({
  timeout: 20_000,
  headers: {
    'user-agent':
      'Picket/0.1 (+https://elastio.com; yabood@elastio.com) regulatory-intel pipeline',
  },
});

/**
 * Fetch and normalize a single RSS/Atom feed into RawItems.
 * `source` is the adapter id stamped on every item (so a merged adapter can
 * still attribute each item to a sub-feed if it overrides this).
 */
export async function fetchRss(opts: {
  source: string;
  url: string;
}): Promise<RawItem[]> {
  const feed = await parser.parseURL(opts.url);

  return feed.items.map((item) => {
    const externalId = item.guid ?? item.link ?? item.id ?? item.title ?? '';
    const publishedAt = item.isoDate
      ? new Date(item.isoDate)
      : item.pubDate
        ? new Date(item.pubDate)
        : null;

    return {
      source: opts.source,
      externalId,
      url: item.link ?? null,
      title: item.title ?? '',
      body:
        item.contentSnippet ??
        item['content:encodedSnippet'] ??
        item.content ??
        item.summary ??
        '',
      publishedAt:
        publishedAt && !Number.isNaN(publishedAt.getTime())
          ? publishedAt
          : null,
      raw: item,
    };
  });
}
