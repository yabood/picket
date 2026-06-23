import { createHash } from 'node:crypto';

import type { RawItem } from '@/lib/sources';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Hash of the as-fetched body — drives change detection. */
export function contentHash(body: string): string {
  return sha256(body ?? '');
}

/**
 * Dedupe key = sha256(source + externalId + contentHash). Including the content
 * hash means a meaningful edit to a previously-seen page (e.g. an amended
 * directive) surfaces as a new row instead of being silently deduped.
 */
export function dedupeKey(
  source: string,
  externalId: string,
  contentHashHex: string,
): string {
  return sha256(`${source}\n${externalId}\n${contentHashHex}`);
}

export function keysFor(
  item: Pick<RawItem, 'source' | 'externalId' | 'body'>,
): { dedupeKey: string; contentHash: string } {
  const ch = contentHash(item.body);
  return { contentHash: ch, dedupeKey: dedupeKey(item.source, item.externalId, ch) };
}
