ALTER TYPE "public"."salon_plan" ADD VALUE 'custom';--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "custom_max_staff" integer;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "custom_analytics" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "custom_self_service_booking" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "custom_api_access" boolean DEFAULT false NOT NULL;