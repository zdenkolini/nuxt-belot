CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"room_id" uuid,
	"ruleset" text NOT NULL,
	"variant" jsonb NOT NULL,
	"seats" jsonb NOT NULL,
	"seed" bigint NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"result" jsonb
);
--> statement-breakpoint
CREATE TABLE "moves" (
	"match_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"seat" integer NOT NULL,
	"move" jsonb NOT NULL,
	CONSTRAINT "moves_match_id_index_pk" PRIMARY KEY("match_id","index")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moves" ADD CONSTRAINT "moves_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;