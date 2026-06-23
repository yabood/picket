import type { Notification } from './format';
import { prettyChangeType, prettySource } from './pretty';

function friendlyDate(d: Date): string {
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function toMarkdown(n: Notification): string {
  const lines: string[] = [];

  lines.push(`# 📋 ${n.instrument}`);
  lines.push('');
  lines.push(
    `**${n.regulator}** · ${prettyChangeType(n.changeType)} · ${n.jurisdiction} · Status: ${n.status}`,
  );
  lines.push('');

  lines.push('## What changed');
  lines.push(n.whatChanged);
  lines.push('');

  if (n.whoIsAffected.length > 0) {
    lines.push('## Who’s affected');
    for (const w of n.whoIsAffected) lines.push(`- ${w}`);
    lines.push('');
  }

  if (n.requirements.length > 0) {
    lines.push('## Requirements');
    for (const r of n.requirements) lines.push(`- ${r}`);
    lines.push('');
  }

  const when: string[] = [];
  if (n.effectiveDate) when.push(`Effective: ${n.effectiveDate}`);
  for (const d of n.deadlines) {
    when.push(d.date ? `${d.description} — ${d.date}` : d.description);
  }
  if (when.length > 0) {
    lines.push('## Effective / deadlines');
    for (const w of when) lines.push(`- ${w}`);
    lines.push('');
  }

  if (n.relevanceArea) {
    lines.push('## Relevance');
    lines.push(n.relevanceArea);
    lines.push('');
  }

  if (n.notableQuote) {
    lines.push(`> ${n.notableQuote}`);
    lines.push('');
  }

  if (n.citations.length > 0) {
    lines.push('## Sources');
    for (const c of n.citations) lines.push(`- [${c.label}](${c.url})`);
    lines.push('');
  }

  lines.push('---');
  const footerBits = [`Source: ${prettySource(n.source)}`, friendlyDate(n.occurredAt)];
  if (n.confidence < 0.8) {
    footerBits.push(`gate confidence ${Math.round(n.confidence * 100)}%`);
  }
  lines.push(`*${footerBits.join(' · ')}*`);

  return lines.join('\n');
}
