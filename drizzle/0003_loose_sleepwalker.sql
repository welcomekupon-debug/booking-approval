CREATE TYPE "public"."change_request_status" AS ENUM('pending', 'approved', 'declined');--> statement-breakpoint
CREATE TYPE "public"."change_request_type" AS ENUM('cancel', 'reschedule');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'change_requested';--> statement-breakpoint
CREATE TABLE "appointment_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"type" "change_request_type" NOT NULL,
	"status" "change_request_status" DEFAULT 'pending' NOT NULL,
	"requested_starts_at" timestamp with time zone,
	"customer_note" text,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_change_requests" ADD CONSTRAINT "appointment_change_requests_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_change_requests" ADD CONSTRAINT "appointment_change_requests_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_change_requests" ADD CONSTRAINT "appointment_change_requests_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_requests_salon_status_idx" ON "appointment_change_requests" USING btree ("salon_id","status");--> statement-breakpoint
CREATE INDEX "change_requests_appointment_idx" ON "appointment_change_requests" USING btree ("appointment_id");