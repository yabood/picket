import { gateway } from '@ai-sdk/gateway';
import { NoObjectGeneratedError, Output, generateText } from 'ai';

import type { Gate } from '@/lib/gate';
import { EXTRACT_MODEL_ID } from '@/lib/model';
import type { RawItem } from '@/lib/sources';

import { EXTRACT_SYSTEM_PROMPT, formatItemForExtractor } from './prompt';
import { BriefSchema, type Brief } from './schema';

export { BriefSchema, type Brief } from './schema';

export async function extract(item: RawItem, g: Gate): Promise<Brief> {
  const userMessage = formatItemForExtractor(item, g);
  try {
    return await callExtractor(userMessage);
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      return await callExtractor(
        userMessage,
        'Your previous response could not be parsed against the required schema. Return a single, strictly valid JSON object this time.',
      );
    }
    throw err;
  }
}

async function callExtractor(
  userMessage: string,
  retryHint?: string,
): Promise<Brief> {
  const result = await generateText({
    model: gateway(EXTRACT_MODEL_ID),
    system: retryHint
      ? `${EXTRACT_SYSTEM_PROMPT}\n\nNOTE: ${retryHint}`
      : EXTRACT_SYSTEM_PROMPT,
    prompt: userMessage,
    output: Output.object({ schema: BriefSchema }),
  });
  return result.output;
}
