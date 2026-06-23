import { extractText, getDocumentProxy } from 'unpdf';

const UA =
  'Picket (Elastio) regulatory-intel pipeline (yabood@elastio.com)';

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Fetch a PDF and extract its text (all pages merged) via unpdf. */
export async function fetchPdfText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/pdf,*/*' },
  });
  if (!res.ok) {
    throw new Error(`fetchPdfText ${url} → ${res.status} ${res.statusText}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  return normalizeWs(text);
}

export function isPdfUrl(url: string | null): boolean {
  if (!url) return false;
  return /\.pdf(\?|#|$)/i.test(url);
}
