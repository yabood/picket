import type { Brief } from '../src/lib/extract/index.js';
import type { Gate } from '../src/lib/gate/index.js';
import {
  buildNotification,
  createSlackSink,
  toMarkdown,
  toSlackBlocks,
} from '../src/lib/notify/index.js';
import type { RawItem } from '../src/lib/sources/types.js';

const SAMPLE_ITEM: RawItem = {
  source: 'cisa-directives',
  externalId: '/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk',
  url: 'https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk',
  title: 'BOD 26-04: Prioritizing Security Updates Based on Risk',
  body: '(full directive text omitted in this fixture)',
  publishedAt: new Date('2026-06-21T00:00:00Z'),
  raw: {},
};

const SAMPLE_GATE: Gate = {
  isMandate: true,
  regulator: 'CISA',
  instrumentType: 'binding_directive',
  jurisdiction: 'US-Federal',
  affectedEntities: 'FCEB agencies',
  imposesNewObligation: true,
  relevantToElastio: true,
  relevanceArea: 'pre-patch compromise assessment',
  confidence: 0.93,
  reasoning: 'CISA BOD requiring forensic triage before patching within the remediation window.',
};

const SAMPLE_BRIEF: Brief = {
  whatChanged:
    'Agencies must run a forensic triage proving a system was not already compromised before applying a patch.',
  changeType: 'new_mandate',
  regulator: 'CISA',
  instrument: 'Binding Operational Directive 26-04',
  jurisdiction: 'US-Federal',
  whoIsAffected: ['All federal civilian executive-branch (FCEB) agencies'],
  requirements: [
    'Pre-patch compromise assessment on affected systems',
    'Retain evidence proving non-compromise',
  ],
  effectiveDate: '2026-06-21',
  deadlines: [
    { description: 'Forensic triage + patch within the emergency-remediation window', date: null },
  ],
  status: 'final',
  relevanceArea: 'pre-patch compromise assessment / backup integrity',
  notableQuote: 'Applying a patch does not evict a threat actor.',
  citations: [],
};

async function main() {
  const n = buildNotification(SAMPLE_ITEM, SAMPLE_GATE, SAMPLE_BRIEF);

  console.log('===== MARKDOWN =====\n');
  console.log(toMarkdown(n));
  console.log('\n===== SLACK BLOCKS =====\n');
  console.log(JSON.stringify(toSlackBlocks(n), null, 2));

  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (webhook) {
    const sink = createSlackSink({ webhookUrl: webhook });
    const res = await sink.send(n);
    console.log(`\nPosted to Slack → ${res.destination}`);
  } else {
    console.log('\n(SLACK_WEBHOOK_URL unset — render only, nothing posted.)');
  }
}

main();
