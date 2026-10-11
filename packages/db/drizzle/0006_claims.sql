CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"guest_id" text NOT NULL,
	"account_id" text NOT NULL,
	"existing" boolean NOT NULL,
	"choice" text,
	"guest_matches" integer NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"decided_at" timestamp
);
