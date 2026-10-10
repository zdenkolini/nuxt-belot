ALTER TABLE "rooms" ADD COLUMN "owner_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "target_score" integer DEFAULT 1001 NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "members" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "seats" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "removed" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;