import type { Brief } from '@/lib/extract';
import type { Gate } from '@/lib/gate';
import {
  getMandatesPage,
  getStatusSnapshot,
  type MandateStatus,
} from '@/lib/admin/queries';
import type { Mandate, Run } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUS_TABS: MandateStatus[] = ['all', 'posted', 'rejected', 'pending'];
const PAGE_SIZE = 50;

function parseStatus(input: string | undefined): MandateStatus {
  return (STATUS_TABS as string[]).includes(input ?? '')
    ? (input as MandateStatus)
    : 'all';
}

function parsePage(input: string | undefined): number {
  const n = Number.parseInt(input ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function fmtTime(d: Date | null): string {
  if (!d) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
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
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);

  const [snapshot, mandatesPage] = await Promise.all([
    getStatusSnapshot(),
    getMandatesPage({ page, pageSize: PAGE_SIZE, status }),
  ]);

  const { mandateCounts, lastRuns } = snapshot;
  const totalPages = Math.max(1, Math.ceil(mandatesPage.total / PAGE_SIZE));

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
      <h1 style={{ marginBottom: 4 }}>📋 Picket</h1>
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
            {lastRuns.map((r: Run) => (
              <tr key={r.id}>
                <td style={TD}>{fmtTime(r.startedAt)}</td>
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
            {lastRuns.length === 0 && (
              <tr>
                <td style={TD} colSpan={9}>
                  No runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 16, marginTop: 28 }}>Mandates</h2>
      <nav style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {STATUS_TABS.map((t) => (
          <a
            key={t}
            href={`/?status=${t}`}
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
                  <td style={TD}>{fmtTime(row.createdAt)}</td>
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
        {page > 1 && <a href={`/?status=${status}&page=${page - 1}`}>← Prev</a>}
        <span style={{ opacity: 0.7 }}>
          Page {page} of {totalPages} · {mandatesPage.total} total
        </span>
        {page < totalPages && <a href={`/?status=${status}&page=${page + 1}`}>Next →</a>}
      </div>
    </main>
  );
}
