import "server-only";

import { and, desc, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookCopies, books, categories, librarySeedMarks, loans, reservations, users } from "@/db/schema";
import { demoBooks, demoCategories, demoCopies } from "@/db/demo-catalog";
import { hashPassword } from "@/lib/security";
import { emailDomain, idPrefix } from "@/lib/branding";
import type { BookCopyView, BookSummary, LibraryCategory, LoanView, ReservationView } from "@/lib/types";

export function formatLocation(copy: Pick<BookCopyView, "building" | "floor" | "section" | "shelf" | "rack">) {
  return `${copy.building} · Floor ${copy.floor} · ${copy.section} · Shelf ${copy.shelf} · ${copy.rack}`;
}

const CATALOG_SEED_KEY = "demo-catalog-v2-subjects";
const BRANDING_MIGRATION_KEY = "branding-mit-v1";

/**
 * Renames records seeded under the previous college name so existing databases
 * match the current branding. Runs once, guarded by a seed mark.
 */
async function applyBrandingMigration() {
  const [done] = await db.select({ key: librarySeedMarks.key })
    .from(librarySeedMarks).where(eq(librarySeedMarks.key, BRANDING_MIGRATION_KEY)).limit(1);
  if (done) return;

  await db.execute(sql`update users set email = replace(email, '@northstar.edu', ${"@" + emailDomain}) where email like '%@northstar.edu'`);
  await db.execute(sql`update users set student_id = replace(student_id, 'NS-', ${idPrefix + "-"}) where student_id like 'NS-%'`);
  await db.execute(sql`update book_copies set barcode = replace(barcode, 'NS-', ${idPrefix + "-"}) where barcode like 'NS-%'`);

  await db.insert(librarySeedMarks).values({ key: BRANDING_MIGRATION_KEY }).onConflictDoNothing();
}

export async function ensureDemoData() {
  await applyBrandingMigration();
  const [alreadySeeded] = await db.select({ key: librarySeedMarks.key })
    .from(librarySeedMarks).where(eq(librarySeedMarks.key, CATALOG_SEED_KEY)).limit(1);
  if (alreadySeeded) {
    await ensureDemoAccounts();
    return;
  }

  await db.insert(categories).values(demoCategories).onConflictDoNothing();
  const categoryRows = await db.select().from(categories);
  const categoryBySlug = new Map(categoryRows.map((category) => [category.slug, category.id]));
  const fallbackCategoryId = categoryRows[0]?.id;
  if (fallbackCategoryId === undefined) return;

  await db.insert(books).values(demoBooks.map((book) => ({
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    description: book.description,
    coverUrl: `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg`,
    publishedYear: book.year,
    publisher: book.publisher,
    categoryId: categoryBySlug.get(book.category) ?? fallbackCategoryId,
  }))).onConflictDoNothing();

  const demoStudentId = await ensureDemoAccounts();

  const bookRows = await db.select({ id: books.id, isbn: books.isbn }).from(books);
  const currentCopies = await db.select({ bookId: bookCopies.bookId }).from(bookCopies);
  const booksWithCopies = new Set(currentCopies.map((copy) => copy.bookId));

  for (const book of bookRows) {
    const placements = demoCopies[book.isbn];
    if (!placements || booksWithCopies.has(book.id)) continue;
    const createdCopies = await db.insert(bookCopies).values(placements.map((placement, index) => ({
      bookId: book.id,
      barcode: `${idPrefix}-${book.isbn.slice(-6)}-${String(index + 1).padStart(2, "0")}`,
      status: demoStudentId ? placement.status : "available",
      building: placement.building,
      floor: placement.floor,
      section: placement.section,
      shelf: placement.shelf,
      rack: placement.rack,
    }))).onConflictDoNothing().returning({ id: bookCopies.id, status: bookCopies.status });

    if (!demoStudentId) continue;
    for (const copy of createdCopies) {
      if (copy.status === "borrowed") {
        await db.insert(loans).values({
          userId: demoStudentId,
          copyId: copy.id,
          checkedOutAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          dueAt: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
        }).onConflictDoNothing();
      } else if (copy.status === "reserved") {
        await db.insert(reservations).values({
          userId: demoStudentId,
          copyId: copy.id,
          expiresAt: new Date(Date.now() + 20 * 60 * 60 * 1000),
        }).onConflictDoNothing();
      }
    }
  }

  await db.insert(librarySeedMarks).values({ key: CATALOG_SEED_KEY }).onConflictDoNothing();
}

async function ensureDemoAccounts() {
  if (process.env.SEED_DEMO_USERS === "false") return null;
  const seedUsers: Array<{ name: string; email: string; studentId: string | null; role: "student" | "librarian" | "admin"; password: string }> = [
    { name: "Jamie Rivera", email: `student@${emailDomain}`, studentId: `${idPrefix}-20418`, role: "student", password: "LibraryStudent!24" },
    { name: "Morgan Lee", email: `librarian@${emailDomain}`, studentId: null, role: "librarian", password: "LibraryStaff!24" },
    { name: "Alex Morgan", email: `admin@${emailDomain}`, studentId: null, role: "admin", password: "LibraryAdmin!24" },
  ];
  let demoStudentId: number | null = null;
  for (const account of seedUsers) {
    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, account.email)).limit(1);
    if (existingUser) {
      if (account.role === "student") demoStudentId = existingUser.id;
      continue;
    }
    const [created] = await db.insert(users).values({
      name: account.name,
      email: account.email,
      studentId: account.studentId,
      role: account.role,
      passwordHash: await hashPassword(account.password),
    }).onConflictDoNothing().returning({ id: users.id });
    if (created && account.role === "student") demoStudentId = created.id;
  }
  return demoStudentId;
}

export async function expireReservations() {
  const now = new Date();
  return db.transaction(async (tx) => {
    const expired = await tx.update(reservations)
      .set({ status: "expired", updatedAt: now })
      .where(and(eq(reservations.status, "active"), lte(reservations.expiresAt, now)))
      .returning({ copyId: reservations.copyId });
    for (const reservation of expired) {
      await tx.update(bookCopies)
        .set({ status: "available", updatedAt: now })
        .where(and(eq(bookCopies.id, reservation.copyId), eq(bookCopies.status, "reserved")));
    }
    return expired.length;
  });
}

export async function getCategories(): Promise<LibraryCategory[]> {
  const rows = await db.select({ id: categories.id, name: categories.name, slug: categories.slug, description: categories.description })
    .from(categories).orderBy(categories.name);
  return rows;
}

export async function getCatalog(filters?: { q?: string; category?: string; availability?: string }): Promise<BookSummary[]> {
  await expireReservations();
  const rows = await db.select({
    id: books.id,
    title: books.title,
    author: books.author,
    isbn: books.isbn,
    description: books.description,
    coverUrl: books.coverUrl,
    publishedYear: books.publishedYear,
    publisher: books.publisher,
    categoryId: categories.id,
    categoryName: categories.name,
    categorySlug: categories.slug,
  }).from(books).innerJoin(categories, eq(books.categoryId, categories.id)).orderBy(books.title);
  const copies = await db.select({ bookId: bookCopies.bookId, status: bookCopies.status }).from(bookCopies);
  const counts = new Map<number, { owned: number; available: number; borrowed: number; reserved: number }>();
  for (const copy of copies) {
    const value = counts.get(copy.bookId) ?? { owned: 0, available: 0, borrowed: 0, reserved: 0 };
    value.owned += 1;
    if (copy.status === "available") value.available += 1;
    if (copy.status === "borrowed") value.borrowed += 1;
    if (copy.status === "reserved") value.reserved += 1;
    counts.set(copy.bookId, value);
  }

  const query = filters?.q?.trim().toLowerCase();
  return rows.map((book) => {
    const total = counts.get(book.id) ?? { owned: 0, available: 0, borrowed: 0, reserved: 0 };
    return {
      ...book,
      copiesOwned: total.owned,
      availableCopies: total.available,
      borrowedCopies: total.borrowed,
      reservedCopies: total.reserved,
      copies: [],
    } satisfies BookSummary;
  }).filter((book) => {
    if (query && !`${book.title} ${book.author} ${book.isbn} ${book.categoryName}`.toLowerCase().includes(query)) return false;
    if (filters?.category && filters.category !== "all" && book.categorySlug !== filters.category) return false;
    if (filters?.availability === "available" && book.availableCopies < 1) return false;
    if (filters?.availability === "unavailable" && book.availableCopies > 0) return false;
    return true;
  });
}

export async function getBookDetail(bookId: number, userId?: number): Promise<BookSummary | null> {
  const [book] = await getCatalog().then((list) => list.filter((item) => item.id === bookId));
  if (!book) return null;
  const copyRows = await db.select({
    id: bookCopies.id,
    bookId: bookCopies.bookId,
    barcode: bookCopies.barcode,
    status: bookCopies.status,
    building: bookCopies.building,
    floor: bookCopies.floor,
    section: bookCopies.section,
    shelf: bookCopies.shelf,
    rack: bookCopies.rack,
  }).from(bookCopies).where(eq(bookCopies.bookId, bookId)).orderBy(bookCopies.building, bookCopies.floor, bookCopies.section, bookCopies.shelf, bookCopies.rack);
  const activeReservations = await db.select({ copyId: reservations.copyId, userId: reservations.userId, expiresAt: reservations.expiresAt })
    .from(reservations).where(eq(reservations.status, "active"));
  const reservationByCopy = new Map(activeReservations.map((reservation) => [reservation.copyId, reservation]));
  const formatted: BookCopyView[] = copyRows.map((copy) => {
    const ownReservation = reservationByCopy.get(copy.id);
    const isMine = userId !== undefined && ownReservation?.userId === userId;
    return {
      ...copy,
      location: formatLocation(copy),
      reservedByMe: isMine,
      reservationExpiresAt: isMine ? ownReservation?.expiresAt.toISOString() ?? null : null,
    };
  });
  return { ...book, copies: formatted };
}

export async function getStudentShelf(userId: number): Promise<{ reservations: ReservationView[]; loans: LoanView[] }> {
  await expireReservations();
  const reservationRows = await db.select({
    id: reservations.id,
    status: reservations.status,
    createdAt: reservations.createdAt,
    expiresAt: reservations.expiresAt,
    copyId: bookCopies.id,
    barcode: bookCopies.barcode,
    copyStatus: bookCopies.status,
    building: bookCopies.building,
    floor: bookCopies.floor,
    section: bookCopies.section,
    shelf: bookCopies.shelf,
    rack: bookCopies.rack,
    bookId: books.id,
    title: books.title,
    author: books.author,
    coverUrl: books.coverUrl,
    categoryName: categories.name,
  }).from(reservations)
    .innerJoin(bookCopies, eq(reservations.copyId, bookCopies.id))
    .innerJoin(books, eq(bookCopies.bookId, books.id))
    .innerJoin(categories, eq(books.categoryId, categories.id))
    .where(eq(reservations.userId, userId))
    .orderBy(desc(reservations.createdAt)).limit(30);
  const loanRows = await db.select({
    id: loans.id,
    checkedOutAt: loans.checkedOutAt,
    dueAt: loans.dueAt,
    returnedAt: loans.returnedAt,
    copyId: bookCopies.id,
    barcode: bookCopies.barcode,
    copyStatus: bookCopies.status,
    building: bookCopies.building,
    floor: bookCopies.floor,
    section: bookCopies.section,
    shelf: bookCopies.shelf,
    rack: bookCopies.rack,
    bookId: books.id,
    title: books.title,
    author: books.author,
    coverUrl: books.coverUrl,
    categoryName: categories.name,
  }).from(loans)
    .innerJoin(bookCopies, eq(loans.copyId, bookCopies.id))
    .innerJoin(books, eq(bookCopies.bookId, books.id))
    .innerJoin(categories, eq(books.categoryId, categories.id))
    .where(eq(loans.userId, userId))
    .orderBy(desc(loans.checkedOutAt)).limit(30);

  return {
    reservations: reservationRows.map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      book: { id: row.bookId, title: row.title, author: row.author, coverUrl: row.coverUrl, categoryName: row.categoryName },
      copy: {
        id: row.copyId, bookId: row.bookId, barcode: row.barcode, status: row.copyStatus,
        building: row.building, floor: row.floor, section: row.section, shelf: row.shelf, rack: row.rack,
        location: formatLocation(row), reservedByMe: row.status === "active", reservationExpiresAt: row.status === "active" ? row.expiresAt.toISOString() : null,
      },
    })),
    loans: loanRows.map((row) => ({
      id: row.id,
      checkedOutAt: row.checkedOutAt.toISOString(),
      dueAt: row.dueAt.toISOString(),
      returnedAt: row.returnedAt?.toISOString() ?? null,
      book: { id: row.bookId, title: row.title, author: row.author, coverUrl: row.coverUrl, categoryName: row.categoryName },
      copy: {
        id: row.copyId, bookId: row.bookId, barcode: row.barcode, status: row.copyStatus,
        building: row.building, floor: row.floor, section: row.section, shelf: row.shelf, rack: row.rack,
        location: formatLocation(row),
      },
    })),
  };
}

export async function getStaffDashboard() {
  await expireReservations();
  const catalog = await getCatalog();
  const copyRows = await db.select({
    id: bookCopies.id,
    bookId: bookCopies.bookId,
    barcode: bookCopies.barcode,
    status: bookCopies.status,
    building: bookCopies.building,
    floor: bookCopies.floor,
    section: bookCopies.section,
    shelf: bookCopies.shelf,
    rack: bookCopies.rack,
  }).from(bookCopies).leftJoin(books, eq(bookCopies.bookId, books.id)).orderBy(books.title, bookCopies.barcode);
  const copiesByBook = new Map<number, BookCopyView[]>();
  for (const copy of copyRows) {
    const list = copiesByBook.get(copy.bookId) ?? [];
    list.push({ ...copy, location: formatLocation(copy) });
    copiesByBook.set(copy.bookId, list);
  }
  const completeCatalog = catalog.map((book) => ({ ...book, copies: copiesByBook.get(book.id) ?? [] }));

  const activeLoanRows = await db.select({
    id: loans.id,
    checkedOutAt: loans.checkedOutAt,
    dueAt: loans.dueAt,
    returnedAt: loans.returnedAt,
    copyId: bookCopies.id,
    barcode: bookCopies.barcode,
    copyStatus: bookCopies.status,
    building: bookCopies.building,
    floor: bookCopies.floor,
    section: bookCopies.section,
    shelf: bookCopies.shelf,
    rack: bookCopies.rack,
    bookId: books.id,
    title: books.title,
    author: books.author,
    coverUrl: books.coverUrl,
    categoryName: categories.name,
    borrowerId: users.id,
    borrowerName: users.name,
    borrowerEmail: users.email,
    borrowerStudentId: users.studentId,
  }).from(loans)
    .innerJoin(users, eq(loans.userId, users.id))
    .innerJoin(bookCopies, eq(loans.copyId, bookCopies.id))
    .innerJoin(books, eq(bookCopies.bookId, books.id))
    .innerJoin(categories, eq(books.categoryId, categories.id))
    .where(isNull(loans.returnedAt))
    .orderBy(loans.dueAt);
  const activeReservationRows = await db.select({
    id: reservations.id,
    createdAt: reservations.createdAt,
    expiresAt: reservations.expiresAt,
    copyId: bookCopies.id,
    barcode: bookCopies.barcode,
    copyStatus: bookCopies.status,
    building: bookCopies.building,
    floor: bookCopies.floor,
    section: bookCopies.section,
    shelf: bookCopies.shelf,
    rack: bookCopies.rack,
    bookId: books.id,
    title: books.title,
    author: books.author,
    coverUrl: books.coverUrl,
    categoryName: categories.name,
    borrowerId: users.id,
    borrowerName: users.name,
    borrowerEmail: users.email,
    borrowerStudentId: users.studentId,
  }).from(reservations)
    .innerJoin(users, eq(reservations.userId, users.id))
    .innerJoin(bookCopies, eq(reservations.copyId, bookCopies.id))
    .innerJoin(books, eq(bookCopies.bookId, books.id))
    .innerJoin(categories, eq(books.categoryId, categories.id))
    .where(eq(reservations.status, "active"))
    .orderBy(reservations.expiresAt);

  const activeLoans: LoanView[] = activeLoanRows.map((row) => ({
    id: row.id,
    checkedOutAt: row.checkedOutAt.toISOString(),
    dueAt: row.dueAt.toISOString(),
    returnedAt: row.returnedAt?.toISOString() ?? null,
    book: { id: row.bookId, title: row.title, author: row.author, coverUrl: row.coverUrl, categoryName: row.categoryName },
    copy: {
      id: row.copyId, bookId: row.bookId, barcode: row.barcode, status: row.copyStatus,
      building: row.building, floor: row.floor, section: row.section, shelf: row.shelf, rack: row.rack,
      location: formatLocation(row),
    },
    borrower: { id: row.borrowerId, name: row.borrowerName, email: row.borrowerEmail, studentId: row.borrowerStudentId },
  }));
  const activeReservations: ReservationView[] = activeReservationRows.map((row) => ({
    id: row.id,
    status: "active",
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    book: { id: row.bookId, title: row.title, author: row.author, coverUrl: row.coverUrl, categoryName: row.categoryName },
    copy: {
      id: row.copyId, bookId: row.bookId, barcode: row.barcode, status: row.copyStatus,
      building: row.building, floor: row.floor, section: row.section, shelf: row.shelf, rack: row.rack,
      location: formatLocation(row),
    },
    borrower: { id: row.borrowerId, name: row.borrowerName, email: row.borrowerEmail, studentId: row.borrowerStudentId },
  }));

  return {
    books: completeCatalog,
    activeLoans,
    activeReservations,
    metrics: {
      titles: completeCatalog.length,
      copies: copyRows.length,
      available: completeCatalog.reduce((sum, book) => sum + book.availableCopies, 0),
      borrowed: activeLoans.length,
      reserved: activeReservations.length,
    },
  };
}
