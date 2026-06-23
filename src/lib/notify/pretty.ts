/**
 * Display helpers. Source slugs become readable names; dates become Slack's
 * native `<!date>` markup so each viewer sees times in their own timezone.
 */

const SOURCE_NAMES: Record<string, string> = {
  'cisa-directives': 'CISA Directives',
  'cisa-news': 'CISA News',
  'sec-rules': 'SEC Rulemaking',
  'eu-dora': 'EU / DORA (ESAs)',
  ecb: 'ECB Banking Supervision',
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  new_mandate: 'New mandate',
  amendment: 'Amendment',
  extension: 'Deadline extension',
  guidance: 'Guidance',
  enforcement: 'Enforcement',
};

export function prettySource(slug: string): string {
  return SOURCE_NAMES[slug] ?? slug;
}

export function prettyChangeType(t: string): string {
  return CHANGE_TYPE_LABELS[t] ?? t;
}

/**
 * Slack `<!date>` markup: each viewer sees the time in their own timezone with
 * relative phrasing ("today at 2:02 PM", "May 29 at 2:02 PM").
 * https://api.slack.com/reference/surfaces/formatting#date-formatting
 */
export function slackDate(d: Date, opts: { withTime?: boolean } = {}): string {
  const withTime = opts.withTime ?? true;
  const unix = Math.floor(d.getTime() / 1000);
  const format = withTime ? '{date_short_pretty} at {time}' : '{date_short_pretty}';
  const fallback = withTime
    ? d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short',
      })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `<!date^${unix}^${format}|${fallback}>`;
}
