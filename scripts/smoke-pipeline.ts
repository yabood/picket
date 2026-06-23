import { extract } from '../src/lib/extract/index.js';
import { gate } from '../src/lib/gate/index.js';
import { buildNotification, createFileSink } from '../src/lib/notify/index.js';
import { cisaDirectives } from '../src/lib/sources/cisa-directives.js';
import { cisaNews } from '../src/lib/sources/cisa-news.js';
import { ecb } from '../src/lib/sources/ecb.js';
import { euDora } from '../src/lib/sources/eu-dora.js';
import { fetchPdfText, fetchReadable, isPdfUrl } from '../src/lib/sources/index.js';
import { secRules } from '../src/lib/sources/sec-rules.js';
import type { RawItem } from '../src/lib/sources/types.js';

// Mirrors the orchestrator's hydrate step (no DB, no Slack post — writes
// briefs to notifications/ via FileSink).
async function hydrate(item: RawItem): Promise<RawItem> {
  if (item.source === 'cisa-directives' || !item.url) return item;
  try {
    const text = isPdfUrl(item.url)
      ? await fetchPdfText(item.url)
      : (await fetchReadable(item.url)).text;
    if (text && text.length > item.body.length) {
      return { ...item, body: text.slice(0, 16_000) };
    }
  } catch {
    /* fall back to snippet */
  }
  return item;
}

async function sample(p: Promise<RawItem[]>, n: number): Promise<RawItem[]> {
  try {
    return (await p).slice(0, n);
  } catch {
    return [];
  }
}

async function main() {
  const items: RawItem[] = [
    ...(await sample(cisaDirectives.fetch(), 6)),
    ...(await sample(cisaNews.fetch(), 5)),
    ...(await sample(secRules.fetch(), 5)),
    ...(await sample(euDora.fetch(), 5)),
    ...(await sample(ecb.fetch(), 5)),
  ];
  console.log(`Pipeline over ${items.length} sampled items (no DB)...\n`);

  const sink = createFileSink({ writeBlocks: true });
  let accepted = 0;
  let posted = 0;

  for (const item of items) {
    const g = await gate(item);
    const accept = g.isMandate && g.imposesNewObligation && g.relevantToElastio && g.confidence >= 0.7;
    if (!accept) {
      console.log(`reject  ${item.source.padEnd(16)} "${item.title.slice(0, 60)}"`);
      continue;
    }
    accepted++;
    const brief = await extract(await hydrate(item), g);
    const n = buildNotification(item, g, brief);
    const res = await sink.send(n);
    posted++;
    console.log(`ACCEPT  ${item.source.padEnd(16)} → ${res.destination}`);
  }

  console.log(`\n${accepted} accepted · ${posted} briefs written to notifications/`);
}

main();
