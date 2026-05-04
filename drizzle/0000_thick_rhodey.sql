CREATE TYPE "public"."approval_status" AS ENUM('unapproved', 'approved', 'denied', 'partially_approved');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('assigned', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."employee_type" AS ENUM('Teacher', 'Staff', 'Admin');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('unreconciled', 'reconciled');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'principal', 'teacher', 'substitute');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "absence_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "assignment_time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"time_off_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"teacher_time_off_id" uuid,
	"sub_assignment_id" uuid,
	"uploaded_by" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text,
	"file_url" text NOT NULL,
	"file_size" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"employee_type" "employee_type" DEFAULT 'Teacher',
	"status" "status" DEFAULT 'active'
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"state" text DEFAULT 'CA',
	"zip" text,
	"phone" text,
	"fax" text,
	"timezone" text DEFAULT 'America/Los_Angeles',
	"day_start_time" time DEFAULT '07:30',
	"day_end_time" time DEFAULT '15:30',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sub_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"substitute_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"total_hours" numeric(4, 2),
	"status" "assignment_status" DEFAULT 'assigned',
	"sub_feedback_rating" integer,
	"sub_feedback_notes" text,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "substitutes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "status" DEFAULT 'active',
	"skills" jsonb DEFAULT '[]'::jsonb,
	"rating" numeric(3, 2) DEFAULT '0',
	"rating_count" integer DEFAULT 0,
	"preferred_at_schools" jsonb DEFAULT '[]'::jsonb,
	"excluded_from_schools" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "teacher_time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"reason_id" uuid,
	"notes_to_admin" text,
	"notes_to_sub" text,
	"admin_only_notes" text,
	"approval_status" "approval_status" DEFAULT 'unapproved',
	"approved_by" uuid,
	"approved_at" timestamp,
	"reconciliation_status" "reconciliation_status" DEFAULT 'unreconciled',
	"substitute_required" boolean DEFAULT true,
	"hold_until" text DEFAULT 'no_hold',
	"accounting_code" text,
	"pay_code" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text,
	"role" "role" NOT NULL,
	"organization_id" uuid NOT NULL,
	"school_id" uuid,
	"status" "status" DEFAULT 'active',
	"avatar_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "absence_reasons" ADD CONSTRAINT "absence_reasons_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_time_off" ADD CONSTRAINT "assignment_time_off_assignment_id_sub_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."sub_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_time_off" ADD CONSTRAINT "assignment_time_off_time_off_id_teacher_time_off_id_fk" FOREIGN KEY ("time_off_id") REFERENCES "public"."teacher_time_off"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_teacher_time_off_id_teacher_time_off_id_fk" FOREIGN KEY ("teacher_time_off_id") REFERENCES "public"."teacher_time_off"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_sub_assignment_id_sub_assignments_id_fk" FOREIGN KEY ("sub_assignment_id") REFERENCES "public"."sub_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_assignments" ADD CONSTRAINT "sub_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_assignments" ADD CONSTRAINT "sub_assignments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_assignments" ADD CONSTRAINT "sub_assignments_substitute_id_substitutes_id_fk" FOREIGN KEY ("substitute_id") REFERENCES "public"."substitutes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitutes" ADD CONSTRAINT "substitutes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_time_off" ADD CONSTRAINT "teacher_time_off_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_time_off" ADD CONSTRAINT "teacher_time_off_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_time_off" ADD CONSTRAINT "teacher_time_off_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_time_off" ADD CONSTRAINT "teacher_time_off_reason_id_absence_reasons_id_fk" FOREIGN KEY ("reason_id") REFERENCES "public"."absence_reasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_time_off" ADD CONSTRAINT "teacher_time_off_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;