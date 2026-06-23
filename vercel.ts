import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  crons: [
    {
      // Mandates publish infrequently and the SLA is 48h — hourly is ample and
      // polite to .gov/.eu sites. Detection latency is never the bottleneck.
      path: '/api/cron/poll',
      schedule: '0 * * * *',
    },
  ],
  functions: {
    'src/app/api/cron/poll/route.ts': {
      maxDuration: 300,
    },
  },
};
