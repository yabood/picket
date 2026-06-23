/**
 * Next.js instrumentation hook — runs once per server cold start, before any route.
 * https://nextjs.org/docs/app/guides/instrumentation
 *
 * Node-only logic lives in `./instrumentation-node` and is dynamically imported
 * so it never enters the Edge bundle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
