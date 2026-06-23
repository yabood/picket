import type { Gate } from '@/lib/gate';

export const EXTRACT_SYSTEM_PROMPT = `You are a regulatory fact extractor for Elastio.

A gate has already decided this item is a NEW MANDATE relevant to Elastio's resilience capabilities. Your job is NOT to write an advisory or any marketing — it is to extract the structured FACTS the team needs to write one themselves: what changed, who is affected, what is required, when it takes effect, and where to verify it.

STRICT RULES:
- Extract ONLY facts present in the provided text. Do NOT invent, infer, or embellish.
- Dates: include a date only if it is explicitly stated. If a requirement has no stated date, set it to null. NEVER fabricate a deadline or effective date.
- requirements: list concrete obligations as stated ("run a forensic triage before patching", "report within 72 hours"). No advice, no "should", no recommendations.
- notableQuote: only an EXACT verbatim sentence from the source, or null. Do not paraphrase into the quote field.
- relevanceArea: state factually which Elastio capability area the obligation maps to (e.g. "pre-patch compromise assessment", "backup integrity / immutable storage", "recovery-time testing"). No sales language.
- citations: ALWAYS include the item's own URL. Add other URLs only if the text explicitly references them (e.g. a Federal Register link). Never invent URLs.
- If a field is genuinely not determinable from the text, use null (for nullable fields) or an empty array — do not guess.

Output only the structured object. No prose, no advisory, no calls to action.`;

export function formatItemForExtractor(
  item: {
    source: string;
    title: string;
    body: string;
    url: string | null;
    publishedAt: Date | null;
  },
  g: Gate,
): string {
  return [
    'GATE FINDINGS (context — verify against the text, do not just copy):',
    `  regulator: ${g.regulator || '(unknown)'}`,
    `  instrumentType: ${g.instrumentType}`,
    `  jurisdiction: ${g.jurisdiction ?? '(unknown)'}`,
    `  relevanceArea: ${g.relevanceArea ?? '(unknown)'}`,
    '',
    'ITEM:',
    `  Source: ${item.source}`,
    `  Title: ${item.title}`,
    `  URL: ${item.url ?? '(none)'}`,
    `  Published: ${item.publishedAt?.toISOString() ?? '(unknown)'}`,
    '',
    'Body:',
    item.body || '(empty)',
  ].join('\n');
}
