import { createConsoleSink } from './console-sink';
import type { Notification } from './format';
import { toMarkdown } from './markdown';
import { toSlackBlocks } from './slack-blocks';
import { createSlackSink } from './slack-sink';

export type { Notification, Citation, Deadline } from './format';
export { buildNotification } from './format';
export { toMarkdown } from './markdown';
export { toSlackBlocks } from './slack-blocks';
export { createConsoleSink } from './console-sink';
export { createSlackSink, SlackSinkError } from './slack-sink';

/**
 * Sink selection precedence:
 * 1. SLACK_WEBHOOK_URL set → SlackSink (everywhere)
 * 2. Running on Vercel (no writable FS) → ConsoleSink
 * 3. Local dev → FileSink under notifications/
 */
export function createDefaultSink(): NotificationSink {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (webhook) {
    return createSlackSink({ webhookUrl: webhook });
  }
  if (process.env.VERCEL) {
    return createConsoleSink();
  }
  return createFileSink({ writeBlocks: true });
}

export interface SinkResult {
  delivered: true;
  destination: string;
}

export interface NotificationSink {
  id: string;
  send(n: Notification): Promise<SinkResult>;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'mandate'
  );
}

function timestampStamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

export interface FileSinkOptions {
  dir?: string;
  writeBlocks?: boolean;
}

export function createFileSink(opts: FileSinkOptions = {}): NotificationSink {
  const writeBlocks = opts.writeBlocks ?? false;

  return {
    id: 'file',
    async send(n) {
      // Local-dev only — node:fs/path are imported lazily so they never get
      // statically traced into the Vercel serverless bundle (where the sink
      // factory picks ConsoleSink/SlackSink instead).
      const { mkdir, writeFile } = await import('node:fs/promises');
      const { dirname, join, resolve } = await import('node:path');

      const dir = resolve(opts.dir ?? join(process.cwd(), 'notifications'));
      const base = `${timestampStamp(n.occurredAt)}-${slugify(n.source)}-${slugify(n.instrument)}`;
      const mdPath = join(dir, `${base}.md`);

      await mkdir(dirname(mdPath), { recursive: true });
      await writeFile(mdPath, toMarkdown(n), 'utf8');

      if (writeBlocks) {
        await writeFile(
          join(dir, `${base}.blocks.json`),
          JSON.stringify(toSlackBlocks(n), null, 2),
          'utf8',
        );
      }

      return { delivered: true, destination: mdPath };
    },
  };
}
