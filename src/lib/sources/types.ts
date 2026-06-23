export interface RawItem {
  source: string;
  externalId: string;
  url: string | null;
  title: string;
  body: string;
  publishedAt: Date | null;
  raw: unknown;
}

export interface Source {
  id: string;
  fetch(): Promise<RawItem[]>;
}
