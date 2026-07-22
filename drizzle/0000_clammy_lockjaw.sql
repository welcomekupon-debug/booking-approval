CREATE TYPE "public"."appointment_source" AS ENUM('staff', 'public', 'tally', 'import');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'confirmed', 'declined', 'cancelled', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'api_key', 'system');--> statement-breakpoint
CREATE TYPE "public"."calendar_provider" AS ENUM('google', 'outlook');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('active', 'paused', 'error', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'manager', 'stylist', 'receptionist');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('new_request', 'confirmation', 'cancellation', 'reminder', 'missed', 'system');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"service_id" uuid,
	"service_name" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"staff_id" uuid,
	"status" "appointment_status" DEFAULT 'pending' NOT NULL,
	"source" "appointment_source" DEFAULT 'staff' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"buffer_before_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"price_total_cents" integer DEFAULT 0 NOT NULL,
	"customer_note" text,
	"internal_note" text,
	"cancellation_reason" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"rescheduled_from_id" uuid,
	"external_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_time_order" CHECK ("appointments"."ends_at" > "appointments"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_user_id" uuid,
	"actor_api_key_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_times" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"staff_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_times_time_order" CHECK ("blocked_times"."ends_at" > "blocked_times"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "business_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"opens_at" time NOT NULL,
	"closes_at" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_hours_weekday_range" CHECK ("business_hours"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "business_hours_time_order" CHECK ("business_hours"."closes_at" > "business_hours"."opens_at")
);
--> statement-breakpoint
CREATE TABLE "calendar_event_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"external_event_id" text NOT NULL,
	"last_pushed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"staff_id" uuid,
	"provider" "calendar_provider" NOT NULL,
	"external_calendar_id" text NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"status" "integration_status" DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_vip" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"salon_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'stylist' NOT NULL,
	"staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"appointment_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"business_type" text,
	"email" text,
	"phone" text,
	"website" text,
	"address" text,
	"logo_url" text,
	"brand_color" text,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"timezone" text DEFAULT 'Europe/Ljubljana' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"buffer_before_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"color" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "services_duration_positive" CHECK ("services"."duration_minutes" > 0),
	CONSTRAINT "services_price_nonnegative" CHECK ("services"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"default_duration_minutes" integer DEFAULT 30 NOT NULL,
	"default_buffer_before_minutes" integer DEFAULT 0 NOT NULL,
	"default_buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"slot_granularity_minutes" integer DEFAULT 15 NOT NULL,
	"max_advance_days" integer DEFAULT 60 NOT NULL,
	"min_notice_minutes" integer DEFAULT 60 NOT NULL,
	"auto_confirm" boolean DEFAULT false NOT NULL,
	"allow_cancellation" boolean DEFAULT true NOT NULL,
	"cancellation_window_hours" integer DEFAULT 24 NOT NULL,
	"revenue_enabled" boolean DEFAULT true NOT NULL,
	"notify_email_new_request" boolean DEFAULT true NOT NULL,
	"notify_email_confirmation" boolean DEFAULT true NOT NULL,
	"notify_email_cancellation" boolean DEFAULT true NOT NULL,
	"notify_email_daily_summary" boolean DEFAULT false NOT NULL,
	"notify_sms_confirmation" boolean DEFAULT false NOT NULL,
	"notify_sms_reminder" boolean DEFAULT false NOT NULL,
	"reminder_hours_before" integer DEFAULT 24 NOT NULL,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"role_title" text,
	"color" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "staff_working_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_hours_weekday_range" CHECK ("staff_working_hours"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "staff_hours_time_order" CHECK ("staff_working_hours"."ends_at" > "staff_working_hours"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_rescheduled_from_id_appointments_id_fk" FOREIGN KEY ("rescheduled_from_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_api_key_id_api_keys_id_fk" FOREIGN KEY ("actor_api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_times" ADD CONSTRAINT "blocked_times_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_times" ADD CONSTRAINT "blocked_times_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_times" ADD CONSTRAINT "blocked_times_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_links" ADD CONSTRAINT "calendar_event_links_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_links" ADD CONSTRAINT "calendar_event_links_integration_id_calendar_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."calendar_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_links" ADD CONSTRAINT "calendar_event_links_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_integrations" ADD CONSTRAINT "calendar_integrations_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_integrations" ADD CONSTRAINT "calendar_integrations_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_working_hours" ADD CONSTRAINT "staff_working_hours_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_working_hours" ADD CONSTRAINT "staff_working_hours_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_salon_idx" ON "api_keys" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "appointment_services_appointment_idx" ON "appointment_services" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_services_salon_service_idx" ON "appointment_services" USING btree ("salon_id","service_id");--> statement-breakpoint
CREATE INDEX "appointments_salon_starts_idx" ON "appointments" USING btree ("salon_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_salon_status_idx" ON "appointments" USING btree ("salon_id","status","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_staff_starts_idx" ON "appointments" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_customer_idx" ON "appointments" USING btree ("customer_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_external_ref_idx" ON "appointments" USING btree ("salon_id","external_ref") WHERE "appointments"."external_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_logs_salon_idx" ON "audit_logs" USING btree ("salon_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "blocked_times_salon_idx" ON "blocked_times" USING btree ("salon_id","starts_at");--> statement-breakpoint
CREATE INDEX "blocked_times_staff_idx" ON "blocked_times" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "business_hours_salon_idx" ON "business_hours" USING btree ("salon_id","weekday");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_event_links_unique_idx" ON "calendar_event_links" USING btree ("integration_id","appointment_id");--> statement-breakpoint
CREATE INDEX "calendar_event_links_appointment_idx" ON "calendar_event_links" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "calendar_integrations_salon_idx" ON "calendar_integrations" USING btree ("salon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_salon_email_idx" ON "customers" USING btree ("salon_id","email") WHERE "customers"."email" IS NOT NULL AND "customers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "customers_salon_name_idx" ON "customers" USING btree ("salon_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_salon_idx" ON "memberships" USING btree ("user_id","salon_id");--> statement-breakpoint
CREATE INDEX "memberships_salon_idx" ON "memberships" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "notifications_salon_idx" ON "notifications" USING btree ("salon_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "salons_slug_idx" ON "salons" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "services_salon_idx" ON "services" USING btree ("salon_id","is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_salon_idx" ON "settings" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "staff_salon_idx" ON "staff" USING btree ("salon_id","is_active");--> statement-breakpoint
CREATE INDEX "staff_working_hours_staff_idx" ON "staff_working_hours" USING btree ("staff_id","weekday");--> statement-breakpoint
CREATE INDEX "staff_working_hours_salon_idx" ON "staff_working_hours" USING btree ("salon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_idx" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");