import { z } from 'zod';

export const GateSchema = z.object({
  isMandate: z
    .boolean()
    .describe(
      'True only if this item IS a regulatory instrument that creates or changes an obligation — a directive, rule, regulation, or binding technical standard. News articles, speeches, fireside chats, blog posts, calls for papers, workshops, consultations, enforcement actions, and personnel announcements are NOT mandates.',
    ),
  regulator: z
    .string()
    .describe('Issuing body, e.g. "CISA", "SEC", "EBA", "ESMA", "ECB". Empty string if unclear.'),
  instrumentType: z
    .enum([
      'binding_directive',
      'emergency_directive',
      'final_rule',
      'proposed_rule',
      'technical_standard',
      'guidance',
      'other',
    ])
    .describe(
      '"binding_directive"/"emergency_directive" = CISA BOD/ED. "final_rule"/"proposed_rule" = SEC rulemaking. "technical_standard" = EU RTS/ITS. "guidance" = non-binding. "other" = anything that is a mandate but none of these.',
    ),
  jurisdiction: z
    .string()
    .nullable()
    .describe('e.g. "US-Federal", "EU", "NY-State". Null if unclear.'),
  affectedEntities: z
    .string()
    .nullable()
    .describe('Who must comply (e.g. "FCEB agencies", "public companies", "financial entities"). Null if unclear.'),
  imposesNewObligation: z
    .boolean()
    .describe(
      'True if this creates NEW required work or changes an existing requirement. False if it merely restates existing rules, extends a deadline with no new work, or is purely informational.',
    ),
  relevantToElastio: z
    .boolean()
    .describe(
      'True if the obligation touches any of: pre-patch compromise assessment / forensic triage, proving a system was not already compromised, backup integrity, immutable/air-gapped backups, ransomware recovery, recovery-time/RTO testing, incident-response evidence retention, threat hunting, or ICT operational-resilience backup & recovery (DORA). False otherwise.',
    ),
  relevanceArea: z
    .string()
    .nullable()
    .describe('Which Elastio capability area it maps to, in a few words. Null if relevantToElastio is false.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('0.9+ when the text is explicit. 0.7-0.89 when likely but with ambiguity. <0.5 when guessing.'),
  reasoning: z
    .string()
    .describe('1-2 short sentences citing the specific phrases that drove the isMandate / relevantToElastio decision.'),
});

export type Gate = z.infer<typeof GateSchema>;
