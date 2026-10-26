"use client";

import { useEffect, useState } from "react";
import { BookmarkCheck, BookmarkPlus, Building2, CalendarDays, CheckCircle2, CircleAlert, Clock3, LoaderCircle, LogIn, MapPin, UserRound, X } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import type { BookCopyView, BookSummary, ReservationOutcome, SessionUser } from "@/lib/types";
import { BookCover, formatDateTime, formatTimeRemaining, StatusBadge } from "@/app/components/ui";

export function BookDetailDialog({
  book: initialBook,
  user,
  onClose,
  onReserve,
  onRequestSignIn,
}: {
  book: BookSummary;
  user: SessionUser | null;
  onClose: () => void;
  onReserve: (copyId: number) => Promise<ReservationOutcome>;
  onRequestSignIn: () => void;
}) {
  const [book, setBook] = useState(initialBook);
  const [loading, setLoading] = useState(true);
  const [busyCopy, setBusyCopy] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmation, setConfirmation] = useState<string>("");
  const [problem, setProblem] = useState<{ message: string; needsSignIn?: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    apiFetch<{ book: BookSummary }>(`/api/books/${initialBook.id}`)
      .then((payload) => { if (live) setBook(payload.book); })
      .catch(() => { if (live) setBook(initialBook); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [initialBook, refreshKey, user?.id]);

  async function reserve(copyId: number) {
    if (busyCopy !== null) return;
    setBusyCopy(copyId);
    setConfirmation("");
    setProblem(null);
    try {
      const outcome = await onReserve(copyId);
      if (outcome.ok) {
        if (outcome.book) setBook(outcome.book);
        const held = outcome.book?.copies.find((copy) => copy.id === copyId);
        setConfirmation(held?.reservationExpiresAt
          ? `Reserved for you until ${formatDateTime(held.reservationExpiresAt)}. Collect it from ${held.location}.`
          : "Reserved for you for 24 hours. Check My shelf for the pickup details.");
        setRefreshKey((value) => value + 1);
      } else {
        setProblem({ message: outcome.message, needsSignIn: outcome.needsSignIn });
        setRefreshKey((value) => value + 1);
      }
    } finally {
      setBusyCopy(null);
    }
  }

  const canReserve = !user || user.role === "student";
  const counts = [
    { label: "Owned", value: book.copiesOwned },
    { label: "Available", value: book.availableCopies, strong: true },
    { label: "Borrowed", value: book.borrowedCopies },
    { label: "Reserved", value: book.reservedCopies },
  ];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="book-dialog" role="dialog" aria-modal="true" aria-labelledby="book-dialog-title">
        <button className="dialog-close" onClick={onClose} aria-label="Close book details"><X size={19} /></button>
        <div className="book-dialog-main">
          <div className="book-dialog-cover"><BookCover book={book} /></div>
          <div className="book-dialog-info">
            <div className="book-dialog-kicker"><span>{book.categoryName}</span>{book.publishedYear ? <span>{book.publishedYear}</span> : null}</div>
            <h2 id="book-dialog-title">{book.title}</h2>
            <p className="book-dialog-author">by {book.author}</p>
            {book.publisher ? <p className="book-publisher">{book.publisher}</p> : null}
            <p className="book-description">{book.description || "No description has been added yet."}</p>
            <div className="isbn-line"><span>ISBN</span><code>{book.isbn}</code></div>
            <div className="book-count-grid">
              {counts.map((count) => <div key={count.label} className={count.strong ? "book-count-highlight" : ""}><strong>{count.value}</strong><span>{count.label}</span></div>)}
            </div>
          </div>
        </div>
        <div className="copy-location-section">
          <div className="copy-section-heading">
            <div><p className="eyebrow">FIND IT ON CAMPUS</p><h3>Copies & shelf locations</h3></div>
            <div className="availability-live"><span /> Live availability</div>
          </div>
          <p className="reservation-identity">
            {user ? <><UserRound size={13} /><span>Reserving as <strong>{user.name}</strong> · {user.role === "student" ? "Student" : user.role === "librarian" ? "Librarian" : "Administrator"}</span></>
                  : <><LogIn size={13} /><span>Sign in with your student account to hold a copy for 24 hours.</span></>}
          </p>
          {problem ? (
            <div className="reservation-problem" role="alert">
              <CircleAlert size={16} />
              <div>
                <p>{problem.message}</p>
                {problem.needsSignIn ? (
                  <button type="button" className="button button-small button-primary" onClick={onRequestSignIn}>
                    <LogIn size={14} /> Sign in again
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {confirmation ? (
            <div className="reservation-confirmation" role="status">
              <CheckCircle2 size={16} />
              <span>{confirmation}</span>
            </div>
          ) : null}
          {user && user.role !== "student" ? (
            <p className="reservation-role-note"><CheckCircle2 size={14} /> You are signed in as {user.role === "admin" ? "an administrator" : "a librarian"}. Reservations belong to student accounts — use the Staff desk to check a copy out.</p>
          ) : null}
          {loading ? <div className="copy-loading"><LoaderCircle size={17} className="spin" /> Checking copy locations…</div> : null}
          {!loading && book.copies.length === 0 ? <p className="copy-empty">No individual copies have been added yet. Ask the library team for help.</p> : null}
          <div className="copy-location-list">
            {book.copies.map((copy: BookCopyView) => (
              <article className={`copy-location-card ${copy.status === "available" ? "copy-is-available" : ""}`} key={copy.id}>
                <div className="copy-location-mark"><Building2 size={17} strokeWidth={1.8} /></div>
                <div className="copy-location-details">
                  <div className="copy-location-topline"><StatusBadge status={copy.status} /><span className="copy-barcode">{copy.barcode}</span></div>
                  <p><MapPin size={14} /> {copy.location}</p>
                  {copy.reservedByMe && copy.reservationExpiresAt ? (
                    <div className="own-reservation-note"><Clock3 size={14} /><span>Held for you · {formatTimeRemaining(copy.reservationExpiresAt)} (until {formatDateTime(copy.reservationExpiresAt)})</span></div>
                  ) : null}
                </div>
                <div className="copy-action">
                  {copy.status === "available" ? (
                    <button className="button button-small button-outline" onClick={() => void reserve(copy.id)} disabled={!canReserve || busyCopy !== null}>
                      {busyCopy === copy.id ? <LoaderCircle size={15} className="spin" /> : <BookmarkPlus size={15} />}
                      {busyCopy === copy.id ? "Reserving…" : !user ? "Sign in to reserve" : user.role !== "student" ? "Student accounts only" : "Reserve copy"}
                    </button>
                  ) : copy.reservedByMe ? (
                    <span className="reserved-for-you"><BookmarkCheck size={15} /> Yours</span>
                  ) : copy.status === "borrowed" ? (
                    <span className="copy-return-note"><CalendarDays size={14} /> Return to shelf after loan</span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          <div className="reservation-footnote"><CheckCircle2 size={15} /><span>Student reservations hold one specific copy for 24 hours. Collect it at the listed location before it expires.</span></div>
        </div>
      </section>
    </div>
  );
}
