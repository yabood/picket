CREATE TABLE "mandates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dedupe_key" text NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text,
	"title" text,
	"body" text,
	"content_hash" text,
	"published_at" timestamp with time zone,
	"raw_payload" jsonb NOT NULL,
	"gate" jsonb,
	"brief" jsonb,
	"slack_ts" text,
	"posted_at" timestamp with time zone,
	"rejected_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"fetched" integer DEFAULT 0 NOT NULL,
	"deduped" integer DEFAULT 0 NOT NULL,
	"gated" integer DEFAULT 0 NOT NULL,
	"accepted" integer DEFAULT 0 NOT NULL,
	"extracted" integer DEFAULT 0 NOT NULL,
	"posted" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mandates_dedupe_key_idx" ON "mandates" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "mandates_posted_at_idx" ON "mandates" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "mandates_created_at_idx" ON "mandates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "mandates_source_idx" ON "mandates" USING btree ("source");--> statement-breakpoint
CREATE INDEX "runs_started_at_idx" ON "runs" USING btree ("started_at");