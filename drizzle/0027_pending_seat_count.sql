ALTER TABLE "organizations" ADD COLUMN "pending_seat_count" integer;
ALTER TABLE "organizations" ADD COLUMN "pending_seat_update_at" timestamp with time zone;
