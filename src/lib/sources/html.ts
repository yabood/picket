import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

const UA =
  'Picket (Elastio) regulatory-intel pipeline (yabood@elastio.com)';

export interface ReadableDoc {
  title: string | null;
  text: string;
}

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) {
    throw new Error(`fetchHtml ${url} → ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/**
 * Extract the main readable text from an HTML string. Tries Readability first
 * (strips nav/boilerplate); on any failure or empty result, falls back to the
 * document body's text content.
 */
export function extractReadable(html: string): ReadableDoc {
  const { document } = parseHTML(html);
  const titleFromTag =
    document.querySelector('title')?.textContent?.trim() || null;

  try {
    const reader = new Readability(document as unknown as Document);
    const article = reader.parse();
    if (article?.textContent && article.textContent.trim().length > 0) {
      return {
        title: article.title?.trim() || titleFromTag,
        text: normalizeWs(article.textContent),
      };
    }
  } catch {
    // fall through to body-text fallback
  }

  const bodyText = normalizeWs(document.body?.textContent ?? '');
  return { title: titleFromTag, text: bodyText };
}

export async function fetchReadable(url: string): Promise<ReadableDoc> {
  const html = await fetchHtml(url);
  return extractReadable(html);
}
