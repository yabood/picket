# Picket

**Regulatory-mandate intelligence pipeline for Elastio.**

Picket watches the regulators that set security obligations — CISA, the SEC, and the EU (DORA / ECB) — detects each newly published mandate, decides whether it imposes work that maps to Elastio's capabilities, and posts a **factual brief** to Slack within the hour: what changed, who's affected, when it takes effect, what's required, and the source. Picket gathers and structures the facts; the team writes the advisory from them. It turns "a new regulation dropped" into a verifiable fact sheet on the team's desk, automatically.

Picket is Scout's sibling. Scout watches ransomware victims for the sales team; Picket watches regulators for the whole company. It reuses Scout's architecture — the `Source` interface, the Slack sink, dedupe + self-healing + audit-by-default, and the Vercel/Neon/Drizzle scaffold — and swaps three stages for the regulatory job.

---

## Why this exists

AI-driven threats are forcing regulators to mandate work that cannot be done manually at the required cadence. CISA's BOD 26-04 is the template: it requires agencies to run a forensic triage proving a system was not already compromised *before* patching, inside the same 72-hour window — "applying a patch does not evict a threat actor." That is the Hunt/Pursuit thesis written into federal policy.

Every mandate like this is a forcing function for automation, and therefore a standing source of demand. Picket exists to catch each one within 48 hours of publication and put the facts in front of the team — what changed and which Elastio capability it touches — so Elastio is first to address the gap while every other vendor is still positioning on patch speed.

## What it does

```
   regulator feeds & pages              Postgres                    Slack
        │                                  │                          ▲
        ▼                                  ▼                          │
   ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐
   │ fetch   │──▶│ dedupe   │──▶│ gate     │──▶│ extract  │──▶│ post    │
   │ sources │   │ (content │   │ (Haiku)  │   │ (Haiku)  │   │ brief   │
   └─────────┘   │  hash)   │   └──────────┘   └──────────┘   └─────────┘
                 └──────────┘        │              │
                      │              └──────────────┴─▶ audit log (every item, accepted or not)
```

Same five-stage shape as Scout; three stages change:

| Stage | Scout | Picket |
|---|---|---|
| dedupe | stable feed `externalId` | `sha256(source + url + content-hash)` — detects new *and* changed pages |
| classify | "is this a company victim?" (Haiku) | **gate**: "is this a relevant new mandate?" (Haiku) |
| enrich | Apollo firmographics | **extract**: structured fact brief — what changed, who, when, source (Haiku) — the deliverable |

`fetch` (new self-hosted source adapters) and `notify` (factual Slack brief) are adapted; everything else is reused.

## Stack

| Concern | Choice |
|---|---|
| Hosting | Vercel (Fluid Compute + Cron Jobs, **hourly**) |
| Framework | Next.js (App Router, latest) |
| Language | TypeScript |
| LLM | Vercel AI SDK v6 via AI Gateway — `generateText({ output: Output.object })` + Zod. **Haiku 4.5** for both the relevance gate and fact extraction |
| Database | Vercel Marketplace Postgres (Neon) + Drizzle ORM |
| Config | `vercel.ts` (typed config, not `vercel.json`) |
| Fetch layer | `rss-parser` for feeds · `fetch` + `@mozilla/readability` for HTML→text · `unpdf` for PDF→text · `sha256` content-hash for change detection. **No managed crawler** — v1 sources are server-rendered gov/regulator sites |
| Output | Slack webhook + Block Kit — one channel, briefs tagged Product / Sales / Marketing |

> **No Firecrawl in v1.** The CISA/SEC/EU sources are well-behaved server-rendered sites that respond to plain `fetch`, and we run our own LLM stages, so a managed crawler/extractor adds cost without buying us anything. The `Source` interface keeps the fetch mechanism swappable — revisit a managed crawler (Firecrawl/Jina Reader) only when **state-level** sources land, where JS-heavy/anti-bot pages appear.

## Data sources (v1)

Each behind a common `Source` interface — adding one is a single file.

| Source | What it catches | Strategy | Fetch |
|---|---|---|---|
| **CISA directives** | Binding/Emergency Operational Directives (the BOD 26-04 case) | `cisa.gov/news-events/directives` is an HTML index with no feed → list directive links, diff against seen, scrape each | `fetch` + readability |
| **CISA alerts/advisories** | broader CISA output | RSS | `rss-parser` |
| **SEC rulemaking** | cyber disclosure & related rules — *not* 8-K victim filings | SEC press-release / proposed-&-final-rules RSS + rule pages | `rss-parser` + `fetch` |
| **EU — EUR-Lex / ESAs (DORA)** | DORA RTS/ITS & technical standards from EBA/ESMA/EIOPA | EUR-Lex (HTML + PDF) and ESA publication pages | `fetch` + readability / `unpdf` |
| **ECB** | banking-supervision press & guidance | RSS | `rss-parser` |

**Deferred to a later phase:** state-level — no single regulator and no single feed, so it gets its own approach. See [Appendix — State-level tier](#appendix--state-level-tier-future-phase).

## Relevance gate (Haiku) — Zod-enforced

Cheap, high-recall first pass run on every fetched item:

```ts
{
  isMandate: boolean              // an actual regulation/directive/rule, not commentary or news
  regulator: string               // "CISA" | "SEC" | "EBA" | "ECB" | ...
  instrumentType: 'binding_directive' | 'emergency_directive' | 'final_rule'
                | 'proposed_rule' | 'technical_standard' | 'guidance' | 'other'
  jurisdiction: string | null     // "US-Federal" | "EU" | ...
  affectedEntities: string | null // who must comply
  imposesNewObligation: boolean   // creates new required work (vs. restating existing rules)
  relevantToElastio: boolean      // touches forensic triage / compromise assessment /
                                  // backup integrity / immutable storage / recovery / threat hunting
  relevanceArea: string | null    // which capability it maps to
  confidence: number              // 0-1; 0.9+ only when text is explicit
  reasoning: string               // 1-2 sentences justifying the call
}
```

**Post-gate filter (what gets extracted):**
```
isMandate && imposesNewObligation && relevantToElastio && confidence >= 0.7
```

## Fact extraction (Haiku) — the deliverable

For v1 Picket does **not** write a publishable advisory. It extracts the structured facts the team needs to write one themselves — what changed, where, effective when, who's affected, and the source. Generated only for items that pass the gate (a handful per week):

```ts
{
  whatChanged: string            // plain statement of the new or changed requirement
  changeType: 'new_mandate' | 'amendment' | 'extension' | 'guidance' | 'enforcement'
  regulator: string              // "CISA" | "SEC" | "EBA" | ...
  instrument: string             // e.g. "Binding Operational Directive 26-04"
  jurisdiction: string           // "US-Federal" | "EU" | "NY-State" | ...
  whoIsAffected: string[]        // regulated entities / sectors that must comply
  requirements: string[]         // what they must now do — factual obligations, not advice
  effectiveDate: string | null   // when it takes effect / compliance date (ISO date or null)
  deadlines: { description: string; date: string | null }[]  // specific windows / SLAs
  status: string                 // "proposed" | "final" | "effective" | "enacted" | ...
  relevanceArea: string          // which Elastio capability area it touches — one factual clause, no pitch
  notableQuote: string | null    // a key verbatim line from the source, if useful for the advisory
  citations: { label: string; url: string }[]               // source links so the team can verify every field
}
```

> **Picket gathers facts; the team writes the advisory.** The tool never drafts copy or publishes anything externally — it delivers a verifiable fact sheet to Slack, and product/sales/marketing decide what to do with it. Both stages run on **Haiku** for v1: the task is extraction with citations the team can verify, so the cheap model is the right default. If accuracy on dense PDFs proves shaky, bumping just the extract stage to a stronger model is a one-line change.

## Slack output

One channel (e.g. `#regulatory-watch`) — the whole team (Matt included) monitors it and self-directs; there's no approval workflow in the tool. Block Kit brief laid out as a fact sheet: header (regulator · instrument · jurisdiction · status), **What changed**, **Who's affected**, **Requirements**, **Effective / deadlines**, a one-line **Relevance** tag, an optional notable quote, and **Sources** (citation links so any field can be verified). No generated advisory copy and no prescribed actions — facts only; the team turns them into the advisory and decides who acts. Reuse Scout's `slack-sink.ts` (webhook masking + the `NotificationSink` interface) verbatim; only the Block Kit layout changes.

## Endpoints

| Route | Purpose |
|---|---|
| `POST /api/cron/poll` | Main pipeline. Triggered by Vercel Cron hourly. |
| `GET  /api/status` | Last-run stats: fetched, gated, accepted, extracted, posted, errors. |
| `POST /api/test` | Run a single URL/item through gate + extract **without** posting or persisting. For prompt iteration. Auth-gated. |
| `GET  /` | Admin status board — mandates by lifecycle state with gate reasoning and rejection reasons. |

## Operational guarantees (carried from Scout)

- **Idempotent.** Dedupe key = `sha256(source + canonical-url + content-hash)`. Re-runs never double-post; a meaningful edit to a previously-seen page surfaces as a new item.
- **Audit-by-default.** Every fetched item is persisted with its gate output — accepted or rejected — so the gate prompt can be tuned over time.
- **Self-healing cron.** Transient gate/extraction failures (rate limits, 5xx, network) leave the row `pending`; the next tick begins with `loadPending()` and reprocesses it. A mid-tick crash or AI Gateway hiccup never loses a mandate.
- **Hourly cadence.** Mandates publish infrequently and the SLA is 48h, so hourly is ample and polite to .gov/.eu sites. Detection latency is never the bottleneck — human drafting is.

## Database schema

```
mandates
  id              uuid pk
  dedupe_key      text unique         -- sha256(source + url + content_hash)
  source          text
  external_id     text
  url             text
  title           text
  body            text                -- extracted page/PDF text, kept so pending rows re-process
  content_hash    text                -- sha256 of extracted body, for change detection
  published_at    timestamptz
  raw_payload     jsonb
  gate            jsonb               -- Haiku relevance-gate output
  brief           jsonb               -- Haiku fact extraction (null until extracted)
  status          text                -- detected | extracted | posted | rejected | pending
  posted_at       timestamptz
  rejected_reason text
  created_at      timestamptz default now()

runs
  id, started_at, finished_at,
  fetched, deduped, gated, accepted, extracted, posted, errors (int counters),
  error text
```

## Environment variables

| Var | Source |
|---|---|
| `DATABASE_URL` | Neon (Vercel Marketplace) |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway. Prefer the OIDC token flow (`vercel env pull`) over a long-lived key. |
| `SLACK_WEBHOOK_URL` | Slack → Incoming Webhooks for the target channel. Optional locally — when unset, the sink writes markdown to `notifications/` (FileSink). |
| `CRON_SECRET` | 32+ char random string. Vercel signs cron requests with it; `/api/cron/poll` verifies. |

## Reused from Scout (copy, don't rebuild)

Lift these from `../scout` largely as-is:
- `src/lib/sources/types.ts` (`Source` / `RawItem`) and `src/lib/sources/rss.ts`
- `src/lib/notify/slack-sink.ts`, `slack-blocks.ts` (relayout), the `NotificationSink` interface, FileSink/ConsoleSink fallback
- The orchestrator shape: `loadPending()` before insert, DB-level `insertIfNew`, worker-pool concurrency, `runs` counters
- `src/lib/env.ts` (Zod fail-fast), `vercel.ts`, the `CRON_SECRET` constant-time auth in the cron route
- `/api/status` and the admin page structure

New for Picket: the Firecrawl-free HTML/PDF fetch adapters, the relevance-gate schema/prompt (Haiku), the fact-extraction schema/prompt (Haiku), and the fact-sheet Block Kit layout.

---

## Implementation phases

### Phase 0 — Pre-flight (verify before writing adapters)
- [ ] Confirm the CISA directives index HTML structure (`cisa.gov/news-events/directives`) and how to enumerate directive links.
- [ ] Confirm CISA alerts/advisories RSS, SEC rules/press RSS, ECB RSS endpoints.
- [ ] Confirm EUR-Lex + ESA (EBA/ESMA/EIOPA) DORA publication URLs and that documents are reachable as HTML and/or PDF.
- [ ] Verify the AI Gateway model slug is live: `anthropic/claude-haiku-4.5` (gateway uses **dots**, not dashes — confirm against `GET https://ai-gateway.vercel.sh/v1/models`).
- [ ] Verify `@mozilla/readability` + a DOM shim (`linkedom`/`jsdom`) and `unpdf` extract clean text from one real CISA page and one real EU PDF.

### Phase 1 — Scaffold
- [ ] New project copying Scout's skeleton: `package.json`, `tsconfig.json`, `next.config.ts`, App Router stubs, `vercel.ts` with `crons: [{ path: '/api/cron/poll', schedule: '0 * * * *' }]` and `maxDuration: 300`.
- [ ] `src/lib/env.ts` — Zod-validated env, fail-fast.
- [ ] `pnpm typecheck` clean; git initialized.

### Phase 2 — Database
- [ ] Drizzle schema (`mandates`, `runs`) + first migration committed.
- [ ] Neon provisioned via Vercel Marketplace; migration applied.

### Phase 3 — Source adapters
- [ ] `Source` interface + shared `RawItem` (reuse Scout).
- [ ] `rss.ts` (reuse), plus a `fetch`+readability HTML helper and an `unpdf` PDF helper.
- [ ] Adapters: `cisa-directives`, `cisa-advisories`, `sec-rules`, `eu-dora`, `ecb`.
- [ ] Content-hash change detection; smoke test prints per-source counts.

### Phase 4 — Relevance gate (Haiku)
- [ ] Zod gate schema + system prompt (with not-a-mandate / not-relevant examples).
- [ ] `gate(item)` via `generateText({ output: Output.object })`; concurrency cap; retry on `NoObjectGeneratedError`.
- [ ] Live smoke on real items.

### Phase 5 — Fact extraction (Haiku)
- [ ] Zod extraction schema + prompt (what changed, who's affected, requirements, effective date, deadlines, status, relevance area, notable quote, citations).
- [ ] `extract(item, gate)` via Haiku; runs only on gate-passers.
- [ ] Live smoke produces a complete, citation-backed fact brief for a sample mandate.

### Phase 6 — Notification output
- [ ] `Notification` model + `toSlackBlocks` (fact-sheet layout) + `toMarkdown`.
- [ ] Reuse `slack-sink.ts`; FileSink locally / Slack in prod.
- [ ] End-to-end smoke writes (or posts) a brief.

### Phase 7 — Orchestrator
- [ ] `pollOnce()`: loadPending → fetch → content-hash dedupe (`insertIfNew`) → gate → filter → extract → post → mark status; `runs` counters; audit-by-default.
- [ ] Self-healing verified (seed a pending row, run a tick, row goes pending→posted).
- [ ] `POST /api/cron/poll`, `nodejs` runtime, `maxDuration=300`, `Bearer ${CRON_SECRET}` auth.

### Phase 8 — Observability
- [ ] `GET /api/status` — last runs + counters + mandate totals by status.
- [ ] `POST /api/test` — single item through gate+extract, no persist/post, auth-gated.
- [ ] `/` admin status board with lifecycle filter tabs and gate reasoning.

### Phase 9 — Deploy & verify
- [ ] `vercel link` + preview deploy; env vars set (Production + Preview).
- [ ] Cron firing visible; a real fact brief lands in the Slack channel.
- [ ] Production promote.

### Phase 10 — Docs & handoff
- [ ] README updated with Slack setup steps; sample brief screenshot.
- [ ] Tuning notes: how to read rejections in `/` and adjust the gate prompt.

---

## Sample Slack brief (mockup)

```
📋 New mandate — CISA BOD 26-04
CISA · Binding Operational Directive · US-Federal · Status: Final

What changed
 Adds a forensic-triage requirement to emergency remediation: agencies must prove a
 system was not already compromised *before* patching it.

Who's affected
 All federal civilian executive-branch (FCEB) agencies.

Requirements
 · Pre-patch compromise assessment on affected systems
 · Retain evidence proving non-compromise

Effective / deadlines
 · Effective immediately on issuance
 · Forensic triage + patch within the same 72h emergency-remediation window

Relevance  Touches compromise-assessment / backup-integrity territory.

“Applying a patch does not evict a threat actor.” — CISA

🔗 Sources
 · cisa.gov/news-events/directives/bod-26-04
 · Federal Register notice (if published)

gate confidence 0.93
```

---

## Appendix — State-level tier (future phase)

Out of v1 on purpose. Unlike CISA or the SEC, state-level has no single regulator and no single feed — mandates come from three different branches of state government, each publishing differently. Scraping 50 legislature sites is not the answer; aggregator APIs are.

### Where state mandates originate

- **Legislatures (statutes)** — breach-notification laws (all 50 states), privacy laws (CCPA/CPRA, VA, CO, CT, TX…), and a growing wave of ransomware/cyber bills. 50 sites, 50 layouts.
- **State regulators (rules)** — where the real cyber *obligations* live: **NYDFS Part 500** (the flagship, periodically amended), the **NAIC Insurance Data Security Model Law** (~half the states, via insurance departments), and state CISO/IT offices (e.g. Texas DIR, California Dept. of Technology) setting requirements for agencies and contractors.
- **State AGs** — guidance and public **breach-notification portals** (CA/ME/WA…). Note: portals list *victims* → that's Scout's lane, **not** a mandate. Keep out of Picket.

### Source architecture — aggregator APIs + a regulator shortlist

| Tier | Source | Covers | Mechanism | Cost / licensing |
|---|---|---|---|---|
| **Backbone** | **Open States (Plural)** | all 50 legislatures, keyword + state filterable | free API key (rate-limited) + open-licensed bulk data | **Free, commercial-safe** — open data license. Start here. |
| **Digest** | **NCSL** tracking pages | curated breach-notification / cyber-legislation roundups | `fetch` + readability (no API) | Free public web pages |
| **Depth** | **NYDFS**, NAIC/insurance depts, bellwether states (CA/NY/TX) | the rules that create real obligations | per-site adapters | Free pages; the no-feed tail is the only candidate for a managed crawler |
| **Upgrade** | **LegiScan API** | richer/fresher bill-status data | JSON API | Free tier is generally **non-commercial only** → paid plan for a vendor product. Only if Open States proves insufficient. |

**Licensing caveat:** "free" and "free *for commercial use*" differ here. Open States' open license clears commercial use; LegiScan's free tier likely does not. Rate limits and terms on all three shift over time — **verify current commercial-use terms before building** (it's the commercial question that bites, not the price).

### Gate change required for this tier

State bills introduce a relevance question federal final-actions don't: **most bills never become law.** Posting every introduced bill would spam the channel. Add a `legislativeStatus` field to the gate schema — `introduced | in_committee | passed | enacted` — and only extract on **enacted** (or near-final). Open States and LegiScan both expose bill status, so this is a cheap filter.

### When a crawler is finally justified

The legislative *bulk* is API-addressable through Open States — **no crawler needed**. Only the regulator shortlist tail (NYDFS-style sites without feeds) is a candidate for a managed reader (Firecrawl / Jina). Revisit that decision when this phase starts, not before.

### Build sketch (e.g. Phase 11)

- [ ] Verify Open States commercial-use terms + rate limits; obtain API key.
- [ ] Open States adapter — keyword (`ransomware`, `data breach`, `backup`, `cybersecurity`) + state filters, carrying bill status through to `RawItem`.
- [ ] NCSL digest adapter (`fetch` + readability) as a curated cross-check.
- [ ] NYDFS adapter (highest-signal single state regulator).
- [ ] Add `legislativeStatus` to the gate schema + an enacted-only filter in the post-gate step.
- [ ] Tune the gate prompt for statute vs. rule vs. dead-bill noise.
