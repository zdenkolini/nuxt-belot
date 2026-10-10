ALTER TABLE "matches" ALTER COLUMN "seed" SET DATA TYPE text;--> statement-breakpoint
-- Old 32-bit seeds do not replay with the new generator; end those matches.
UPDATE "matches" SET "status" = 'ended' WHERE "status" = 'running';
