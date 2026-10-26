import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["student", "librarian", "admin"]);
export const copyStatusEnum = pgEnum("copy_status", ["available", "borrowed", "reserved", "maintenance"]);
export const reservationStatusEnum = pgEnum("reservation_status", ["active", "collected", "cancelled", "expired"]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 140 }).notNull(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    studentId: varchar("student_id", { length: 48 }),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("student"),
    active: boolean("active").notNull().default(true),
    passwordResetTokenHash: text("password_reset_token_hash"),
    passwordResetExpiresAt: timestamp("password_reset_expires_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("users_role_active_idx").on(table.role, table.active)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    userId: integer("user_id").notNull().references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_idx").on(table.userId), index("sessions_expiry_idx").on(table.expiresAt)],
);

export const librarySeedMarks = pgTable("library_seed_marks", {
  key: varchar("key", { length: 80 }).primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
);

export const books = pgTable(
  "books",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 240 }).notNull(),
    author: varchar("author", { length: 180 }).notNull(),
    isbn: varchar("isbn", { length: 24 }).notNull().unique(),
    description: text("description").notNull().default(""),
    coverUrl: text("cover_url"),
    publishedYear: integer("published_year"),
    publisher: varchar("publisher", { length: 180 }),
    categoryId: integer("category_id").notNull().references(() => categories.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("books_category_title_idx").on(table.categoryId, table.title)],
);

export const bookCopies = pgTable(
  "book_copies",
  {
    id: serial("id").primaryKey(),
    bookId: integer("book_id").notNull().references(() => books.id),
    barcode: varchar("barcode", { length: 64 }).notNull().unique(),
    status: copyStatusEnum("status").notNull().default("available"),
    building: varchar("building", { length: 120 }).notNull().default("Main Library"),
    floor: varchar("floor", { length: 40 }).notNull().default("1"),
    section: varchar("section", { length: 100 }).notNull().default("General collection"),
    shelf: varchar("shelf", { length: 80 }).notNull().default("A1"),
    rack: varchar("rack", { length: 80 }).notNull().default("1"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("book_copies_book_status_idx").on(table.bookId, table.status),
    index("book_copies_barcode_idx").on(table.barcode),
  ],
);

export const loans = pgTable(
  "loans",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    copyId: integer("copy_id").notNull().references(() => bookCopies.id),
    checkedOutAt: timestamp("checked_out_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }).notNull(),
    returnedAt: timestamp("returned_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("loans_user_due_idx").on(table.userId, table.dueAt),
    uniqueIndex("loans_one_active_per_copy_idx").on(table.copyId).where(sql`${table.returnedAt} IS NULL`),
  ],
);

export const reservations = pgTable(
  "reservations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    copyId: integer("copy_id").notNull().references(() => bookCopies.id),
    status: reservationStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("reservations_user_status_idx").on(table.userId, table.status),
    index("reservations_expiration_idx").on(table.status, table.expiresAt),
    uniqueIndex("reservations_one_active_per_copy_idx").on(table.copyId).where(sql`${table.status} = 'active'`),
  ],
);
