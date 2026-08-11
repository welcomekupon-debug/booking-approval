CREATE TYPE "public"."promo_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "promo_label" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "promo_type" "promo_type";--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "promo_value" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "promo_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "promo_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_promo_value_valid" CHECK ("services"."promo_value" IS NULL OR "services"."promo_value" >= 0);--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_promo_window_valid" CHECK (("services"."promo_starts_at" IS NULL AND "services"."promo_ends_at" IS NULL) OR ("services"."promo_starts_at" IS NOT NULL AND "services"."promo_ends_at" IS NOT NULL AND "services"."promo_ends_at" > "services"."promo_starts_at"));