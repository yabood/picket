import { gate } from '../src/lib/gate/index.js';
import { cisaDirectives } from '../src/lib/sources/cisa-directives.js';
import { cisaNews } from '../src/lib/sources/cisa-news.js';
import { ecb } from '../src/lib/sources/ecb.js';
import { euDora } from '../src/lib/sources/eu-dora.js';
import { secRules } from '../src/lib/sources/sec-rules.js';
import type { RawItem } from '../src/lib/sources/types.js';

async function take(p: Promise<RawItem[]>, n: number): Promise<RawItem[]> {
  try {
    return (await p).slice(0, n);
  } catch {
    return [];
  }
}

async function main() {
  // A curated mix: directives/news (expect mandates) + SEC/EU/ECB (mix of
  // mandates, unrelated rules, and non-mandates like speeches).
  const items: RawItem[] = [
    ...(await take(cisaDirectives.fetch(), 2)),
    ...(await take(cisaNews.fetch(), 2)),
    ...(await take(secRules.fetch(), 3)),
    ...(await take(euDora.fetch(), 2)),
    ...(await take(ecb.fetch(), 2)),
  ];

  console.log(`Gating ${items.length} items...\n`);
  for (const item of items) {
    try {
      const g = await gate(item);
      const verdict =
        g.isMandate && g.imposesNewObligation && g.relevantToElastio
          ? 'ACCEPT'
          : 'reject';
      console.log(
        `[${verdict}] ${item.source} · mandate=${g.isMandate} obligation=${g.imposesNewObligation} relevant=${g.relevantToElastio} conf=${g.confidence.toFixed(2)}`,
      );
      console.log(`   "${item.title.slice(0, 80)}"`);
      console.log(`   ${g.reasoning}\n`);
    } catch (err) {
      console.log(`[ERROR] ${item.source} — ${(err as Error).message}\n`);
    }
  }
}

main();
