import type { Notification, NotificationSink } from './index';
import { toSlackBlocks } from './slack-blocks';

export interface SlackSinkOptions {
  webhookUrl: string;
  /** Override fetch (for tests). */
  fetchImpl?: typeof fetch;
}

export class SlackSinkError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = 'SlackSinkError';
  }
}

export function createSlackSink(opts: SlackSinkOptions): NotificationSink {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = opts.webhookUrl;

  // Mask the webhook URL for logs/destination strings — never echo the secret path.
  const masked = url.replace(
    /(hooks\.slack\.com\/services\/)(.+)/,
    (_m, prefix) => `${prefix}***`,
  );

  return {
    id: 'slack',
    async send(n: Notification) {
      const payload = toSlackBlocks(n);
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new SlackSinkError(
          `Slack webhook returned ${res.status}: ${body || res.statusText}`,
          res.status,
          body,
        );
      }

      return { delivered: true, destination: masked };
    },
  };
}
