CREATE TABLE "chore_completions" (
	"id" serial PRIMARY KEY,
	"schedule_id" integer NOT NULL,
	"completed_by" text NOT NULL,
	"week_start_date" date NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chores" (
	"id" serial PRIMARY KEY,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"emoji" text DEFAULT '✅' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_schedule" (
	"id" serial PRIMARY KEY,
	"chore_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"assigned_to" text DEFAULT 'all' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chore_completions" ADD CONSTRAINT "chore_completions_schedule_id_weekly_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "weekly_schedule"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "weekly_schedule" ADD CONSTRAINT "weekly_schedule_chore_id_chores_id_fkey" FOREIGN KEY ("chore_id") REFERENCES "chores"("id") ON DELETE CASCADE;