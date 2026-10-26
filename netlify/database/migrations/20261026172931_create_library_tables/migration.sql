CREATE TYPE "copy_status" AS ENUM('available', 'borrowed', 'reserved', 'maintenance');--> statement-breakpoint
CREATE TYPE "reservation_status" AS ENUM('active', 'collected', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('student', 'librarian', 'admin');--> statement-breakpoint
CREATE TABLE "book_copies" (
	"id" serial PRIMARY KEY,
	"book_id" integer NOT NULL,
	"barcode" varchar(64) NOT NULL UNIQUE,
	"status" "copy_status" DEFAULT 'available'::"copy_status" NOT NULL,
	"building" varchar(120) DEFAULT 'Main Library' NOT NULL,
	"floor" varchar(40) DEFAULT '1' NOT NULL,
	"section" varchar(100) DEFAULT 'General collection' NOT NULL,
	"shelf" varchar(80) DEFAULT 'A1' NOT NULL,
	"rack" varchar(80) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" serial PRIMARY KEY,
	"title" varchar(240) NOT NULL,
	"author" varchar(180) NOT NULL,
	"isbn" varchar(24) NOT NULL UNIQUE,
	"description" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"published_year" integer,
	"publisher" varchar(180),
	"category_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY,
	"name" varchar(100) NOT NULL UNIQUE,
	"slug" varchar(120) NOT NULL UNIQUE,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_seed_marks" (
	"key" varchar(80) PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"copy_id" integer NOT NULL,
	"checked_out_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"returned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"copy_id" integer NOT NULL,
	"status" "reservation_status" DEFAULT 'active'::"reservation_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY,
	"token_hash" varchar(64) NOT NULL UNIQUE,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"name" varchar(140) NOT NULL,
	"email" varchar(320) NOT NULL UNIQUE,
	"student_id" varchar(48),
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'student'::"user_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"password_reset_token_hash" text,
	"password_reset_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "book_copies_book_status_idx" ON "book_copies" ("book_id","status");--> statement-breakpoint
CREATE INDEX "book_copies_barcode_idx" ON "book_copies" ("barcode");--> statement-breakpoint
CREATE INDEX "books_category_title_idx" ON "books" ("category_id","title");--> statement-breakpoint
CREATE INDEX "loans_user_due_idx" ON "loans" ("user_id","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "loans_one_active_per_copy_idx" ON "loans" ("copy_id") WHERE "returned_at" IS NULL;--> statement-breakpoint
CREATE INDEX "reservations_user_status_idx" ON "reservations" ("user_id","status");--> statement-breakpoint
CREATE INDEX "reservations_expiration_idx" ON "reservations" ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_one_active_per_copy_idx" ON "reservations" ("copy_id") WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" ("expires_at");--> statement-breakpoint
CREATE INDEX "users_role_active_idx" ON "users" ("role","active");--> statement-breakpoint
ALTER TABLE "book_copies" ADD CONSTRAINT "book_copies_book_id_books_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id");--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id");--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_copy_id_book_copies_id_fkey" FOREIGN KEY ("copy_id") REFERENCES "book_copies"("id");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_copy_id_book_copies_id_fkey" FOREIGN KEY ("copy_id") REFERENCES "book_copies"("id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");