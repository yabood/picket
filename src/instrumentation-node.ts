/**
 * Node-runtime-only instrumentation. Loaded dynamically from `instrumentation.ts`
 * so its contents never enter the Edge bundle.
 *
 * Silences one specific Node deprecation warning emitted on every cold start by
 * `rss-parser`'s internal use of `url.parse()`. The warning is cosmetic but
 * pollutes Vercel logs.
 */
const originalEmitWarning = process.emitWarning.bind(process);
type EmitWarning = typeof process.emitWarning;

const filtered: EmitWarning = ((warning: unknown, ...rest: unknown[]) => {
  const looksLikeDep0169 =
    rest.some(
      (r) =>
        typeof r === 'object' &&
        r !== null &&
        (r as { code?: string }).code === 'DEP0169',
    ) ||
    rest.includes('DEP0169') ||
    (typeof warning === 'string' && warning.includes('DEP0169')) ||
    (warning instanceof Error && warning.message.includes('DEP0169'));

  if (looksLikeDep0169) return;
  return (originalEmitWarning as (...args: unknown[]) => void)(
    warning,
    ...rest,
  );
}) as EmitWarning;

process.emitWarning = filtered;

export {};
