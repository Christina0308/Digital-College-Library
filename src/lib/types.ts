export type UserRole = "student" | "librarian" | "admin";
export type CopyStatus = "available" | "borrowed" | "reserved" | "maintenance";
export type ReservationStatus = "active" | "collected" | "cancelled" | "expired";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  studentId: string | null;
  role: UserRole;
};

export type LibraryCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
};

export type BookCopyView = {
  id: number;
  bookId: number;
  barcode: string;
  status: CopyStatus;
  building: string;
  floor: string;
  section: string;
  shelf: string;
  rack: string;
  location: string;
  reservedByMe?: boolean;
  reservationExpiresAt?: string | null;
};

export type BookSummary = {
  id: number;
  title: string;
  author: string;
  isbn: string;
  description: string;
  coverUrl: string | null;
  publishedYear: number | null;
  publisher: string | null;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  copiesOwned: number;
  borrowedCopies: number;
  reservedCopies: number;
  availableCopies: number;
  copies: BookCopyView[];
};

export type ReservationView = {
  id: number;
  status: ReservationStatus;
  createdAt: string;
  expiresAt: string;
  book: Pick<BookSummary, "id" | "title" | "author" | "coverUrl" | "categoryName">;
  copy: BookCopyView;
  borrower?: Pick<SessionUser, "id" | "name" | "email" | "studentId">;
};

export type LoanView = {
  id: number;
  checkedOutAt: string;
  dueAt: string;
  returnedAt: string | null;
  book: Pick<BookSummary, "id" | "title" | "author" | "coverUrl" | "categoryName">;
  copy: BookCopyView;
  borrower?: Pick<SessionUser, "id" | "name" | "email" | "studentId">;
};

export type ReservationOutcome =
  | { ok: true; book: BookSummary | null }
  | { ok: false; message: string; needsSignIn?: boolean };
