# CLAUDE.md — Picket build rules

Picket is a regulatory-mandate intelligence pipeline (CISA / SEC / EU) modeled on its sibling
project **Scout** (`../scout`). Read `README.md` for the full spec. This file is the short list
of non-negotiable conventions — follow them without rediscovering them.

## Workflow
- **Package manager is pnpm.** Never use npm/yarn to add or run.
- **Run `pnpm typecheck` after every code change.** It must pass clean before a phase is "done".
- **Smoke-test per layer.** Each `scripts/smoke-*.ts` verifies one layer against live services
  (`pnpm smoke:sources` | `smoke:gate` | `smoke:extract` | `smoke:pipeline`). Run the relevant one
  after touching that layer.

## TypeScript
- `strict: true`, target ES2022, `moduleResolution: bundler`. Import from `@/...` (alias → `src/`).
- No `allowJs`. No `any` unless unavoidable and commented.

## AI SDK (v6)
- Use `generateText({ model, output: Output.object({ schema }), prompt })` with
  `import { generateText, Output } from 'ai'`. **Do NOT use `generateObject`** — the Vercel
  validator flags it as the wrong v6 path even though it's still exported.
- Model is reached via `gateway('anthropic/claude-haiku-4.5')` from `@ai-sdk/gateway`.
  **The gateway slug uses dots, not dashes** (`claude-haiku-4.5`).
- Both stages (gate + extract) run on Haiku 4.5 in v1.

## Vercel
- Configure via **`vercel.ts`** (typed `@vercel/config`), never `vercel.json`.
- Cron is hourly (`0 * * * *`); the poll route is `nodejs` runtime, `maxDuration = 300`.

## Environment
- All env is **Zod-validated in `src/lib/env.ts` and fails fast on boot.** Add new vars there.
- Required: `DATABASE_URL`, `AI_GATEWAY_API_KEY`, `CRON_SECRET`. Optional: `SLACK_WEBHOOK_URL`.
- **Never log secrets.** The Slack webhook URL is masked before it appears in any destination
  string or log (see `notify/slack-sink.ts`).

## Pipeline invariants (do not break)
- **Idempotent.** Dedupe key = `sha256(source + url + content_hash)`. Re-runs never double-post;
  a meaningful content change to a seen page surfaces as a new item.
- **Audit-by-default.** Every fetched item is persisted with its gate output — accepted or
  rejected — for prompt tuning. Never silently drop an item.
- **Self-healing.** Transient gate/extract failures leave the row `pending` (NULL gate, NULL
  rejected_reason). `loadPending()` runs at the top of each tick — **before** `insertIfNew` — and
  reprocesses them. Never mark a transient failure as rejected.

## Sources
- Each source is one file behind the `Source` interface (`src/lib/sources/types.ts`).
- **No managed crawler in v1.** HTML via `fetch` + `@mozilla/readability` (+ `linkedom`); PDFs via
  `unpdf`; feeds via `rss-parser`. State-level / Open States is a deferred phase (see README appendix).

## Product boundary
- **Picket gathers facts; it never publishes.** The extract stage produces a structured fact brief
  (what changed / who / when / requirements / sources) — not advisory copy, not marketing, not
  external output. The Slack post is internal distribution only.

## Where things live
- `src/lib/sources/` — adapters + shared `RawItem` (`fetch` layer).
- `src/lib/gate/` — relevance-gate Zod schema, prompt, `gate()`/`gateBatch()`.
- `src/lib/extract/` — fact-extraction Zod schema, prompt, `extract()`.
- `src/lib/notify/` — `Notification` model, `toMarkdown`, `toSlackBlocks`, sinks, `createDefaultSink()`.
- `src/lib/orchestrator/` — `dedupeKey()`, `insertIfNew`, `loadPending`, `pollOnce()`.
- `src/lib/db/` — Drizzle schema + Neon client.
- `src/app/api/cron/poll/route.ts` — cron entry point.
