import type { Brief } from '@/lib/extract';
import type { Gate } from '@/lib/gate';
import {
  getMandateCounts,
  getMandatesPage,
  getRunsPage,
  type MandateStatus,
} from '@/lib/admin/queries';
import type { Mandate, Run } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUS_TABS: MandateStatus[] = ['all', 'posted', 'rejected', 'pending'];
const MANDATES_PAGE_SIZE = 100;
const RUNS_PAGE_SIZE = 5;

function parseStatus(input: string | undefined): MandateStatus {
  return (STATUS_TABS as string[]).includes(input ?? '')
    ? (input as MandateStatus)
    : 'all';
}

function parsePage(input: string | undefined): number {
  const n = Number.parseInt(input ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Exact, unambiguous timestamp (UTC) — used as the hover title. */
function fmtAbsolute(d: Date): string {
  return (
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    }).format(d) + ' UTC'
  );
}

/**
 * Friendly, at-a-glance time. Relative ("12 mins ago") for the last week,
 * falling back to a readable absolute date for older items. `now` is passed in
 * so every row on a render shares one reference point.
 */
function fmtWhen(d: Date | null, now: number): string {
  if (!d) return '—';
  const diff = now - d.getTime();
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return 'just now';
  if (diff < hour) {
    const n = Math.floor(diff / min);
    return `${n} min${n === 1 ? '' : 's'} ago`;
  }
  if (diff < day) {
    const n = Math.floor(diff / hour);
    return `${n} hour${n === 1 ? '' : 's'} ago`;
  }
  if (diff < 7 * day) {
    const n = Math.floor(diff / day);
    return n === 1 ? 'yesterday' : `${n} days ago`;
  }
  return fmtAbsolute(d);
}

function fmtDuration(start: Date | null, end: Date | null): string {
  if (!start || !end) return '—';
  const ms = end.getTime() - start.getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function statusOf(row: Mandate): 'posted' | 'rejected' | 'pending' {
  if (row.postedAt) return 'posted';
  if (row.rejectedReason) return 'rejected';
  return 'pending';
}

function statusColor(status: 'posted' | 'rejected' | 'pending'): string {
  if (status === 'posted') return '#0a7d28';
  if (status === 'rejected') return '#9b1c1c';
  return '#8a6d00';
}

const TD: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid color-mix(in srgb, CanvasText 12%, transparent)',
  verticalAlign: 'top',
  fontSize: 13,
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; rp?: string }>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);
  const runsPageNum = parsePage(params.rp);

  const [mandateCounts, runsPage, mandatesPage] = await Promise.all([
    getMandateCounts(),
    getRunsPage({ page: runsPageNum, pageSize: RUNS_PAGE_SIZE }),
    getMandatesPage({ page, pageSize: MANDATES_PAGE_SIZE, status }),
  ]);

  const totalPages = Math.max(1, Math.ceil(mandatesPage.total / MANDATES_PAGE_SIZE));
  const runsTotalPages = Math.max(1, Math.ceil(runsPage.total / RUNS_PAGE_SIZE));
  const now = Date.now();

  // Build a URL that preserves the other controls' state. `page` is the
  // mandates page, `rp` the recent-runs page; both are omitted when 1 (and
  // status when 'all') to keep URLs clean.
  const hrefWith = (next: { status?: MandateStatus; page?: number; rp?: number }) => {
    const s = next.status ?? status;
    const p = next.page ?? page;
    const r = next.rp ?? runsPageNum;
    const sp = new URLSearchParams();
    if (s !== 'all') sp.set('status', s);
    if (p > 1) sp.set('page', String(p));
    if (r > 1) sp.set('rp', String(r));
    const qs = sp.toString();
    return qs ? `/?${qs}` : '/';
  };

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: '1.5rem',
        maxWidth: 1100,
        margin: '0 auto',
        lineHeight: 1.45,
      }}
    >
      <h1 style={{ marginBottom: 4 }}>Picket</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>
        Regulatory-mandate intelligence — {mandateCounts.total} tracked ·{' '}
        <span style={{ color: statusColor('posted') }}>{mandateCounts.posted} posted</span> ·{' '}
        <span style={{ color: statusColor('rejected') }}>{mandateCounts.rejected} rejected</span> ·{' '}
        <span style={{ color: statusColor('pending') }}>{mandateCounts.pending} pending</span>
      </p>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Recent runs</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', opacity: 0.7 }}>
              <th style={TD}>Started</th>
              <th style={TD}>Took</th>
              <th style={TD}>Fetched</th>
              <th style={TD}>Deduped</th>
              <th style={TD}>Gated</th>
              <th style={TD}>Accepted</th>
              <th style={TD}>Extracted</th>
              <th style={TD}>Posted</th>
              <th style={TD}>Errors</th>
            </tr>
          </thead>
          <tbody>
            {runsPage.rows.map((r: Run) => (
              <tr key={r.id}>
                <td style={TD} title={r.startedAt ? fmtAbsolute(r.startedAt) : undefined}>
                  {fmtWhen(r.startedAt, now)}
                </td>
                <td style={TD}>{fmtDuration(r.startedAt, r.finishedAt)}</td>
                <td style={TD}>{r.fetched}</td>
                <td style={TD}>{r.deduped}</td>
                <td style={TD}>{r.gated}</td>
                <td style={TD}>{r.accepted}</td>
                <td style={TD}>{r.extracted}</td>
                <td style={TD}>{r.posted}</td>
                <td style={{ ...TD, color: r.errors > 0 ? statusColor('rejected') : undefined }}>
                  {r.errors}
                </td>
              </tr>
            ))}
            {runsPage.rows.length === 0 && (
              <tr>
                <td style={TD} colSpan={9}>
                  No runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 13, alignItems: 'center' }}>
        {runsPageNum > 1 && <a href={hrefWith({ rp: runsPageNum - 1 })}>← Prev</a>}
        <span style={{ opacity: 0.7 }}>
          Page {runsPageNum} of {runsTotalPages} · {runsPage.total} total
        </span>
        {runsPageNum < runsTotalPages && <a href={hrefWith({ rp: runsPageNum + 1 })}>Next →</a>}
      </div>

      <h2 style={{ fontSize: 16, marginTop: 28 }}>Mandates</h2>
      <nav style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {STATUS_TABS.map((t) => (
          <a
            key={t}
            href={hrefWith({ status: t, page: 1 })}
            style={{
              padding: '3px 10px',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 13,
              border: '1px solid color-mix(in srgb, CanvasText 20%, transparent)',
              fontWeight: t === status ? 700 : 400,
              background:
                t === status ? 'color-mix(in srgb, CanvasText 10%, transparent)' : 'transparent',
              color: 'inherit',
            }}
          >
            {t}
          </a>
        ))}
      </nav>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ textAlign: 'left', opacity: 0.7 }}>
              <th style={TD}>Mandate</th>
              <th style={TD}>Source</th>
              <th style={TD}>Status</th>
              <th style={TD}>Detail</th>
              <th style={TD}>Conf</th>
              <th style={TD}>Seen</th>
            </tr>
          </thead>
          <tbody>
            {mandatesPage.rows.map((row) => {
              const s = statusOf(row);
              const g = row.gate as Gate | null;
              const brief = row.brief as Brief | null;
              const heading = brief?.instrument || row.title || row.externalId;
              return (
                <tr key={row.id}>
                  <td style={{ ...TD, maxWidth: 320 }}>
                    {row.url ? (
                      <a href={row.url} style={{ color: 'inherit' }}>
                        {heading}
                      </a>
                    ) : (
                      heading
                    )}
                  </td>
                  <td style={TD}>{row.source}</td>
                  <td style={{ ...TD, color: statusColor(s), fontWeight: 600 }}>{s}</td>
                  <td style={{ ...TD, maxWidth: 460 }}>
                    {s === 'rejected' && (
                      <span style={{ opacity: 0.8 }}>
                        {row.rejectedReason}
                        {g?.reasoning ? ` — ${g.reasoning}` : ''}
                      </span>
                    )}
                    {s === 'posted' && brief && (
                      <span>
                        {brief.whatChanged}
                        {brief.relevanceArea ? (
                          <em style={{ opacity: 0.7 }}> · {brief.relevanceArea}</em>
                        ) : null}
                      </span>
                    )}
                    {s === 'pending' && (
                      <span style={{ opacity: 0.6 }}>awaiting processing</span>
                    )}
                  </td>
                  <td style={TD}>{g ? g.confidence.toFixed(2) : '—'}</td>
                  <td style={TD} title={row.createdAt ? fmtAbsolute(row.createdAt) : undefined}>
                    {fmtWhen(row.createdAt, now)}
                  </td>
                </tr>
              );
            })}
            {mandatesPage.rows.length === 0 && (
              <tr>
                <td style={TD} colSpan={6}>
                  No mandates for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 13, alignItems: 'center' }}>
        {page > 1 && <a href={hrefWith({ page: page - 1 })}>← Prev</a>}
        <span style={{ opacity: 0.7 }}>
          Page {page} of {totalPages} · {mandatesPage.total} total
        </span>
        {page < totalPages && <a href={hrefWith({ page: page + 1 })}>Next →</a>}
      </div>
    </main>
  );
}
