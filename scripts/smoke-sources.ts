import { sources } from '../src/lib/sources/index.js';

async function main() {
  let failures = 0;
  for (const src of sources) {
    process.stdout.write(`${src.id.padEnd(18)} `);
    const started = Date.now();
    try {
      const items = await src.fetch();
      const elapsed = Date.now() - started;
      const first = items[0];
      const sample = first ? ` — "${first.title.slice(0, 70)}"` : '';
      console.log(`${String(items.length).padStart(3)} items in ${elapsed}ms${sample}`);
      if (items.length === 0) failures++;
    } catch (err) {
      const elapsed = Date.now() - started;
      console.log(`ERROR after ${elapsed}ms — ${(err as Error).message}`);
      failures++;
    }
  }
  if (failures > 0) {
    console.error(`\n${failures} source(s) returned 0 items or errored.`);
    process.exit(1);
  }
  console.log('\nAll sources returned items.');
}

main();
