import { and, eq, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { bookCopies, books, categories, loans, reservations, users } from "@/db/schema";
import { ensureDemoData, expireReservations, getStaffDashboard } from "@/lib/library";
import { idPrefix } from "@/lib/branding";
import { getCurrentUser } from "@/lib/security";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function text(body: Record<string, unknown>, key: string, maxLength: number, required = false) {
  const value = typeof body[key] === "string" ? body[key].trim() : "";
  if (required && !value) throw new Error(`FIELD_${key.toUpperCase()}`);
  if (value.length > maxLength) throw new Error(`FIELD_${key.toUpperCase()}`);
  return value;
}

function positiveId(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`FIELD_${field.toUpperCase()}`);
  return number;
}

function cleanCoverUrl(value: string) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
    return parsed.toString();
  } catch {
    throw new Error("FIELD_COVER_URL");
  }
}

function errorMessage(error: unknown) {
  const field = error instanceof Error ? error.message : "";
  const labels: Record<string, string> = {
    FIELD_TITLE: "Enter a title of 240 characters or fewer.",
    FIELD_AUTHOR: "Enter an author of 180 characters or fewer.",
    FIELD_ISBN: "Enter a valid ISBN (7–24 characters).",
    FIELD_CATEGORY_ID: "Choose a valid category.",
    FIELD_DESCRIPTION: "Description must be 8,000 characters or fewer.",
    FIELD_PUBLISHER: "Publisher must be 180 characters or fewer.",
    FIELD_COVER_URL: "Cover URL must be a valid HTTP or HTTPS address.",
    FIELD_PUBLISHED_YEAR: "Enter a valid publication year.",
    FIELD_BOOK_ID: "Choose a valid book.",
    FIELD_COPY_ID: "Choose a valid copy.",
    FIELD_BARCODE: "Barcode must be 64 characters or fewer.",
    FIELD_BUILDING: "Building name must be 120 characters or fewer.",
    FIELD_FLOOR: "Floor must be 40 characters or fewer.",
    FIELD_SECTION: "Section must be 100 characters or fewer.",
    FIELD_SHELF: "Shelf must be 80 characters or fewer.",
    FIELD_RACK: "Rack must be 80 characters or fewer.",
    FIELD_STATUS: "Choose available or maintenance for a manual status change.",
    FIELD_EMAIL: "Enter the student's college email address.",
    FIELD_LOAN_ID: "Choose a valid loan.",
    BOOK_NOT_FOUND: "That book could not be found.",
    COPY_NOT_FOUND: "That copy could not be found.",
    COPY_BUSY: "Borrowed and reserved copies cannot be manually marked available or in maintenance.",
    COPY_UNAVAILABLE: "That copy is not available to check out.",
    BORROWER_NOT_FOUND: "No active student account matches that email.",
    RESERVATION_OWNER: "That copy is reserved for a different student.",
    LOAN_ALREADY_RETURNED: "That loan has already been returned.",
    BOOK_IN_CIRCULATION: "Return or cancel active copies before removing this title.",
  };
  return labels[field] ?? "We could not complete that library update. Check the details and try again.";
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return jsonError("Sign in to access staff tools.", 401);
  if (currentUser.role !== "librarian" && currentUser.role !== "admin") return jsonError("Librarian access is required.", 403);
  try {
    await ensureDemoData();
    return Response.json(await getStaffDashboard(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Staff dashboard query failed:", error);
    return jsonError("Staff tools are temporarily unavailable.", 500);
  }
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return jsonError("Sign in to access staff tools.", 401);
  if (currentUser.role !== "librarian" && currentUser.role !== "admin") return jsonError("Librarian access is required.", 403);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return jsonError("Please send a valid request.");
  }

  try {
    await ensureDemoData();
    await expireReservations();
    const action = text(body, "action", 40, true);

    if (action === "create-book" || action === "update-book") {
      const title = text(body, "title", 240, true);
      const author = text(body, "author", 180, true);
      const isbn = text(body, "isbn", 24, true).replace(/\s/g, "");
      const description = text(body, "description", 8000);
      const publisher = text(body, "publisher", 180);
      const coverUrl = cleanCoverUrl(text(body, "coverUrl", 1200));
      const categoryId = positiveId(body.categoryId, "category_id");
      const publishedYearText = text(body, "publishedYear", 4);
      const publishedYear = publishedYearText ? Number(publishedYearText) : null;
      if (isbn.length < 7) throw new Error("FIELD_ISBN");
      if (publishedYear !== null && (!Number.isInteger(publishedYear) || publishedYear < 1000 || publishedYear > new Date().getFullYear() + 1)) throw new Error("FIELD_PUBLISHED_YEAR");
      const [category] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1);
      if (!category) throw new Error("FIELD_CATEGORY_ID");
      const values = {
        title,
        author,
        isbn,
        description,
        coverUrl,
        publisher: publisher || null,
        categoryId,
        publishedYear,
        updatedAt: new Date(),
      };
      if (action === "create-book") {
        const [book] = await db.insert(books).values(values).returning({ id: books.id });
        return Response.json({ ok: true, bookId: book.id, message: "Book added to the collection." }, { status: 201 });
      }
      const bookId = positiveId(body.bookId, "book_id");
      const [updated] = await db.update(books).set(values).where(eq(books.id, bookId)).returning({ id: books.id });
      if (!updated) throw new Error("BOOK_NOT_FOUND");
      return Response.json({ ok: true, message: "Book details updated." });
    }

    if (action === "delete-book") {
      const bookId = positiveId(body.bookId, "book_id");
      const result = await db.transaction(async (tx) => {
        const [book] = await tx.select({ id: books.id }).from(books).where(eq(books.id, bookId)).limit(1);
        if (!book) throw new Error("BOOK_NOT_FOUND");
        const copies = await tx.select({ id: bookCopies.id, status: bookCopies.status }).from(bookCopies).where(eq(bookCopies.bookId, bookId));
        if (copies.some((copy) => copy.status === "borrowed" || copy.status === "reserved")) throw new Error("BOOK_IN_CIRCULATION");
        const copyIds = copies.map((copy) => copy.id);
        if (copyIds.length) {
          await tx.delete(reservations).where(inArray(reservations.copyId, copyIds));
          await tx.delete(loans).where(inArray(loans.copyId, copyIds));
          await tx.delete(bookCopies).where(inArray(bookCopies.id, copyIds));
        }
        await tx.delete(books).where(eq(books.id, bookId));
        return true;
      });
      return Response.json({ ok: result, message: "Book and its inventory record were removed." });
    }

    if (action === "create-copy") {
      const bookId = positiveId(body.bookId, "book_id");
      const [book] = await db.select({ id: books.id }).from(books).where(eq(books.id, bookId)).limit(1);
      if (!book) throw new Error("BOOK_NOT_FOUND");
      const barcode = text(body, "barcode", 64) || `${idPrefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const building = text(body, "building", 120, true);
      const floor = text(body, "floor", 40, true);
      const section = text(body, "section", 100, true);
      const shelf = text(body, "shelf", 80, true);
      const rack = text(body, "rack", 80, true);
      const [copy] = await db.insert(bookCopies).values({ bookId, barcode, building, floor, section, shelf, rack, status: "available" }).returning({ id: bookCopies.id });
      return Response.json({ ok: true, copyId: copy.id, message: "Copy added and marked available." }, { status: 201 });
    }

    if (action === "update-copy") {
      const copyId = positiveId(body.copyId, "copy_id");
      const requestedStatus = body.status;
      if (requestedStatus !== undefined && requestedStatus !== "available" && requestedStatus !== "maintenance") throw new Error("FIELD_STATUS");
      const result = await db.transaction(async (tx) => {
        const [copy] = await tx.select().from(bookCopies).where(eq(bookCopies.id, copyId)).for("update").limit(1);
        if (!copy) throw new Error("COPY_NOT_FOUND");
        if (requestedStatus && (copy.status === "borrowed" || copy.status === "reserved")) throw new Error("COPY_BUSY");
        const update: Partial<typeof bookCopies.$inferInsert> = { updatedAt: new Date() };
        for (const field of ["building", "floor", "section", "shelf", "rack"] as const) {
          if (body[field] !== undefined) update[field] = text(body, field, field === "building" ? 120 : field === "floor" ? 40 : field === "section" ? 100 : 80, true);
        }
        if (requestedStatus) update.status = requestedStatus;
        await tx.update(bookCopies).set(update).where(eq(bookCopies.id, copyId));
        return true;
      });
      return Response.json({ ok: result, message: "Copy record updated." });
    }

    if (action === "checkout") {
      const copyId = positiveId(body.copyId, "copy_id");
      const email = text(body, "email", 320, true).toLowerCase();
      const result = await db.transaction(async (tx) => {
        const [copy] = await tx.select({ id: bookCopies.id, status: bookCopies.status }).from(bookCopies)
          .where(eq(bookCopies.id, copyId)).for("update").limit(1);
        if (!copy) throw new Error("COPY_NOT_FOUND");
        const [borrower] = await tx.select({ id: users.id, active: users.active, role: users.role }).from(users)
          .where(eq(users.email, email)).limit(1);
        if (!borrower || !borrower.active || borrower.role !== "student") throw new Error("BORROWER_NOT_FOUND");
        if (copy.status === "reserved") {
          const [reservation] = await tx.select({ id: reservations.id, userId: reservations.userId }).from(reservations)
            .where(and(eq(reservations.copyId, copyId), eq(reservations.status, "active"))).limit(1);
          if (!reservation || reservation.userId !== borrower.id) throw new Error("RESERVATION_OWNER");
          await tx.update(reservations).set({ status: "collected", updatedAt: new Date() }).where(eq(reservations.id, reservation.id));
        } else if (copy.status !== "available") {
          throw new Error("COPY_UNAVAILABLE");
        }
        const now = new Date();
        const [loan] = await tx.insert(loans).values({ userId: borrower.id, copyId, checkedOutAt: now, dueAt: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000) })
          .returning({ id: loans.id });
        await tx.update(bookCopies).set({ status: "borrowed", updatedAt: now }).where(eq(bookCopies.id, copyId));
        return loan.id;
      });
      return Response.json({ ok: true, loanId: result, message: "Checkout recorded. The book is due in 21 days." }, { status: 201 });
    }

    if (action === "return") {
      const loanId = positiveId(body.loanId, "loan_id");
      const result = await db.transaction(async (tx) => {
        const [loan] = await tx.select({ id: loans.id, copyId: loans.copyId, returnedAt: loans.returnedAt }).from(loans)
          .where(eq(loans.id, loanId)).for("update").limit(1);
        if (!loan) throw new Error("FIELD_LOAN_ID");
        if (loan.returnedAt) throw new Error("LOAN_ALREADY_RETURNED");
        const now = new Date();
        await tx.update(loans).set({ returnedAt: now }).where(eq(loans.id, loanId));
        await tx.update(bookCopies).set({ status: "available", updatedAt: now }).where(eq(bookCopies.id, loan.copyId));
        return true;
      });
      return Response.json({ ok: result, message: "Return recorded. The copy is available again." });
    }

    return jsonError("That staff action is not supported.");
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const message = errorMessage(error);
    if (code === "23505") return jsonError("That ISBN or barcode is already in use.", 409);
    if (message !== "We could not complete that library update. Check the details and try again.") return jsonError(message, message.includes("could not be found") ? 404 : 400);
    console.error("Staff update failed:", error);
    return jsonError(message, 500);
  }
}
