import { cisaDirectives } from './cisa-directives';
import { cisaNews } from './cisa-news';
import { ecb } from './ecb';
import { euDora } from './eu-dora';
import { secRules } from './sec-rules';
import type { Source } from './types';

export const sources: Source[] = [
  cisaDirectives,
  cisaNews,
  secRules,
  euDora,
  ecb,
];

export { fetchReadable } from './html';
export { fetchPdfText, isPdfUrl } from './pdf';
export type { RawItem, Source } from './types';
