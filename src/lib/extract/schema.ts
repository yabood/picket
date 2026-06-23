import { z } from 'zod';

/**
 * The deliverable: the structured facts the team needs to write an advisory.
 * NOT advisory copy, NOT marketing, NOT recommended actions — facts only.
 * Every field must be grounded in the source text; unknowns are null/empty.
 */
export const BriefSchema = z.object({
  whatChanged: z
    .string()
    .describe('Plain one-to-three sentence statement of the new or changed requirement. Facts only.'),
  changeType: z
    .enum(['new_mandate', 'amendment', 'extension', 'guidance', 'enforcement'])
    .describe('Is this a brand-new mandate, an amendment to an existing one, a deadline extension, guidance, or enforcement?'),
  regulator: z.string().describe('Issuing body, e.g. "CISA", "SEC", "EBA".'),
  instrument: z
    .string()
    .describe('The instrument name/number, e.g. "Binding Operational Directive 26-04".'),
  jurisdiction: z.string().describe('e.g. "US-Federal", "EU".'),
  whoIsAffected: z
    .array(z.string())
    .describe('Regulated entities / sectors that must comply. Empty array if unstated.'),
  requirements: z
    .array(z.string())
    .describe('What affected entities must now do — concrete factual obligations, not advice. Empty array if unstated.'),
  effectiveDate: z
    .string()
    .nullable()
    .describe('When it takes effect / compliance date, ISO (YYYY-MM-DD) if stated, else null. Do NOT invent a date.'),
  deadlines: z
    .array(
      z.object({
        description: z.string(),
        date: z.string().nullable(),
      }),
    )
    .describe('Specific windows or compliance deadlines stated in the text (e.g. a 72-hour triage window). Empty array if none.'),
  status: z
    .string()
    .describe('e.g. "proposed", "final", "effective", "in force", "enacted" — as stated in the source.'),
  relevanceArea: z
    .string()
    .describe('Which Elastio capability area this maps to, factually (e.g. "pre-patch compromise assessment"). No pitch.'),
  notableQuote: z
    .string()
    .nullable()
    .describe('A short verbatim line from the source useful for the advisory, or null. Must be an exact quote.'),
  citations: z
    .array(
      z.object({
        label: z.string(),
        url: z.string(),
      }),
    )
    .describe('Source links so the team can verify every field. Always include the item URL. Add others only if explicitly referenced in the text.'),
});

export type Brief = z.infer<typeof BriefSchema>;
