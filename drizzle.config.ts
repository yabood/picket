import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations run DDL, which can misbehave over Neon's pooled (PgBouncer)
    // endpoint — prefer the direct/unpooled connection when present (Vercel +
    // the Neon integration set DATABASE_URL_UNPOOLED). Locally we usually only
    // have DATABASE_URL, so fall back to it.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
} satisfies Config;
