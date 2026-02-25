CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"achievement_type" text NOT NULL,
	"unlocked_at" timestamp with time zone NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"reward_type" text NOT NULL,
	"reward_name" text NOT NULL,
	"reward_description" text,
	"earned_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"perfect_days" integer DEFAULT 0 NOT NULL,
	"last_check_in" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_stats_user_id_unique" UNIQUE("user_id")
);
