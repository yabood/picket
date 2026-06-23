import { extractReadable, fetchHtml } from './html';
import type { RawItem, Source } from './types';

const INDEX = 'https://www.cisa.gov/news-events/directives';
const BASE = 'https://www.cisa.gov';

// Directive pages look like /news-events/directives/bod-26-04-...,
// ed-25-03-..., supplemental-direction-ed-25-03-..., v1-ed-26-03-...
// The index also links filter pages (/directives/all?...) and a reference
// "FCEB agencies list" — this pattern matches only real directive slugs.
const DIRECTIVE_RE =
  /\/news-events\/directives\/(?:v\d+-)?(?:supplemental-direction-)?(?:bod|ed)-\d{2}-\d{2}[a-z0-9-]*/gi;

// Bound the per-page body so a long directive doesn't blow the LLM context.
const MAX_BODY = 12_000;

function slugToTitle(path: string): string {
  const slug = path.split('/').pop() ?? path;
  return slug
    .replace(/-/g, ' ')
    .replace(/\b(bod|ed)\b/gi, (m) => m.toUpperCase())
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const cisaDirectives: Source = {
  id: 'cisa-directives',
  async fetch(): Promise<RawItem[]> {
    const indexHtml = await fetchHtml(INDEX);
    const paths = Array.from(
      new Set((indexHtml.match(DIRECTIVE_RE) ?? []).map((p) => p.toLowerCase())),
    );

    const items: RawItem[] = [];
    for (const path of paths) {
      const url = `${BASE}${path}`;
      try {
        const html = await fetchHtml(url);
        const doc = extractReadable(html);
        items.push({
          source: 'cisa-directives',
          externalId: path,
          url,
          title: doc.title ?? slugToTitle(path),
          body: doc.text.slice(0, MAX_BODY),
          // CISA directive pages don't expose a reliable machine-readable date
          // here; null keeps the item (the orchestrator never age-drops nulls)
          // and the gate/extract read any dates out of the body text.
          publishedAt: null,
          raw: { path, url, title: doc.title ?? slugToTitle(path) },
        });
      } catch (err) {
        console.error(
          `[cisa-directives] failed ${url}: ${(err as Error).message}`,
        );
      }
    }
    return items;
  },
};
