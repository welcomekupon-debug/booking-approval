CREATE TYPE "public"."salon_plan" AS ENUM('starter', 'professional', 'business');--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "plan" "salon_plan" DEFAULT 'starter' NOT NULL;