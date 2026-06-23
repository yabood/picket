import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  AI_GATEWAY_API_KEY: z.string().min(1),
  // Optional — when unset, the sink factory falls back to FileSink (local) or
  // ConsoleSink (Vercel). Set it to post real briefs to the channel.
  SLACK_WEBHOOK_URL: z
    .union([z.string().url(), z.literal('')])
    .optional()
    .transform((v) => (v ? v : undefined)),
  CRON_SECRET: z.string().min(16),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
