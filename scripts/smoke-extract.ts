import { extract } from '../src/lib/extract/index.js';
import { gate } from '../src/lib/gate/index.js';
import { cisaDirectives } from '../src/lib/sources/cisa-directives.js';

async function main() {
  const items = await cisaDirectives.fetch();
  console.log(`Fetched ${items.length} CISA directives. Gating...\n`);

  let chosen = items[0];
  let chosenGate = null;

  for (const item of items) {
    const g = await gate(item);
    const accept = g.isMandate && g.imposesNewObligation && g.relevantToElastio;
    console.log(
      `${accept ? 'ACCEPT' : 'reject'}  "${item.title.slice(0, 70)}" (conf ${g.confidence.toFixed(2)})`,
    );
    if (accept && !chosenGate) {
      chosen = item;
      chosenGate = g;
    }
  }

  if (!chosen) {
    console.error('No directives fetched.');
    process.exit(1);
  }
  if (!chosenGate) {
    console.log('\nNo directive passed the gate; extracting the first one anyway for a shape check.');
    chosenGate = await gate(chosen);
  }

  console.log(`\nExtracting brief for: "${chosen.title}"\n`);
  const brief = await extract(chosen, chosenGate);
  console.log(JSON.stringify(brief, null, 2));
}

main();
