import { gateway } from '@ai-sdk/gateway';
import { NoObjectGeneratedError, Output, generateText } from 'ai';

import { GATE_MODEL_ID } from '@/lib/model';
import type { RawItem } from '@/lib/sources';

import { GATE_SYSTEM_PROMPT, formatItemForGate } from './prompt';
import { GateSchema, type Gate } from './schema';

export { GateSchema, type Gate } from './schema';

export async function gate(item: RawItem): Promise<Gate> {
  const userMessage = formatItemForGate(item);
  try {
    return await callGate(userMessage);
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      return await callGate(
        userMessage,
        'Your previous response could not be parsed against the required schema. Return a single, strictly valid JSON object this time.',
      );
    }
    throw err;
  }
}

async function callGate(userMessage: string, retryHint?: string): Promise<Gate> {
  const result = await generateText({
    model: gateway(GATE_MODEL_ID),
    system: retryHint
      ? `${GATE_SYSTEM_PROMPT}\n\nNOTE: ${retryHint}`
      : GATE_SYSTEM_PROMPT,
    prompt: userMessage,
    output: Output.object({ schema: GateSchema }),
  });
  return result.output;
}

export interface GateBatchResult {
  item: RawItem;
  result: { ok: true; gate: Gate } | { ok: false; error: string };
}

export async function gateBatch(
  items: RawItem[],
  opts: { concurrency?: number } = {},
): Promise<GateBatchResult[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 5);
  const results: GateBatchResult[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      const item = items[i]!;
      try {
        const g = await gate(item);
        results[i] = { item, result: { ok: true, gate: g } };
      } catch (err) {
        results[i] = {
          item,
          result: { ok: false, error: (err as Error).message },
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );

  return results;
}
