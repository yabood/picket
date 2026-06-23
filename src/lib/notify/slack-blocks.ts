import type { Notification } from './format';
import { prettyChangeType, prettySource, slackDate } from './pretty';

type SlackBlock = Record<string, unknown>;

const MAX_LIST = 8; // cap bullet lists so a block never exceeds Slack limits
const MAX_TEXT = 2900; // Slack section text hard limit is 3000

function clamp(s: string, max = MAX_TEXT): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function bullets(items: string[]): string {
  const shown = items.slice(0, MAX_LIST).map((i) => `• ${i}`);
  if (items.length > MAX_LIST) shown.push(`• …and ${items.length - MAX_LIST} more`);
  return shown.join('\n');
}

function section(text: string): SlackBlock {
  return { type: 'section', text: { type: 'mrkdwn', text: clamp(text) } };
}

export function toSlackBlocks(n: Notification): {
  text: string;
  blocks: SlackBlock[];
} {
  const blocks: SlackBlock[] = [];

  // 1. Header — the instrument (Slack header is plain_text, ~150 char limit).
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: clamp(`📋 ${n.instrument}`, 150), emoji: true },
  });

  // 2. Context line — regulator · change type · jurisdiction · status.
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: [
          `*${n.regulator}*`,
          prettyChangeType(n.changeType),
          n.jurisdiction,
          `Status: ${n.status}`,
        ]
          .filter(Boolean)
          .join('  ·  '),
      },
    ],
  });

  // 3. What changed.
  blocks.push(section(`*What changed*\n${n.whatChanged}`));

  // 4. Who's affected.
  if (n.whoIsAffected.length > 0) {
    blocks.push(section(`*Who's affected*\n${bullets(n.whoIsAffected)}`));
  }

  // 5. Requirements.
  if (n.requirements.length > 0) {
    blocks.push(section(`*Requirements*\n${bullets(n.requirements)}`));
  }

  // 6. Effective / deadlines.
  const when: string[] = [];
  if (n.effectiveDate) when.push(`Effective: ${n.effectiveDate}`);
  for (const d of n.deadlines) {
    when.push(d.date ? `${d.description} — ${d.date}` : d.description);
  }
  if (when.length > 0) {
    blocks.push(section(`*Effective / deadlines*\n${bullets(when)}`));
  }

  // 7. Relevance (one factual line).
  if (n.relevanceArea) {
    blocks.push(section(`*Relevance*\n${n.relevanceArea}`));
  }

  // 8. Notable quote.
  if (n.notableQuote) {
    blocks.push(section(`> ${n.notableQuote}`));
  }

  // 9. Sources.
  if (n.citations.length > 0) {
    const links = n.citations
      .slice(0, MAX_LIST)
      .map((c) => `• <${c.url}|${c.label}>`)
      .join('\n');
    blocks.push(section(`🔗 *Sources*\n${links}`));
  }

  // 10. Footer — source attribution, freshness, gate confidence.
  const footer: string[] = [`*${prettySource(n.source)}*`];
  footer.push(slackDate(n.occurredAt));
  if (n.confidence < 0.8) {
    footer.push(`_gate confidence ${Math.round(n.confidence * 100)}%_`);
  }
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: footer.join(' · ') }],
  });

  return {
    text: `📋 ${prettyChangeType(n.changeType)} — ${n.instrument}`,
    blocks,
  };
}
