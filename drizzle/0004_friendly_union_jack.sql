CREATE TYPE "public"."business_category" AS ENUM('salon', 'fitness', 'medical', 'consulting', 'other');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "membership_role" DEFAULT 'stylist' NOT NULL,
	"token" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" uuid,
	"accepted_by_user_id" uuid,
	"accepted_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salons" ADD COLUMN "category" "business_category" DEFAULT 'salon' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_platform_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_idx" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invitations_salon_idx" ON "invitations" USING btree ("salon_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_salon_email_pending_idx" ON "invitations" USING btree ("salon_id","email") WHERE "invitations"."status" = 'pending';