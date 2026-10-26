"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { BookOpen, Building2, CalendarClock, Check, ChevronDown, ClipboardList, LoaderCircle, MapPin, PackagePlus, Pencil, Plus, RotateCcw, Search, Trash2, UsersRound, X } from "lucide-react";
import { apiFetch, apiPost } from "@/lib/client-api";
import type { BookCopyView, BookSummary, LibraryCategory, LoanView, ReservationView } from "@/lib/types";
import { emailDomain } from "@/lib/branding";
import { BookCover, EmptyState, formatDateTime, StatusBadge } from "@/app/components/ui";

type StaffReservation = ReservationView & { borrower?: { id: number; name: string; email: string; studentId: string | null } };
export type StaffWorkspaceData = {
  books: BookSummary[];
  activeLoans: LoanView[];
  activeReservations: StaffReservation[];
  metrics: { titles: number; copies: number; available: number; borrowed: number; reserved: number };
};
type ToastKind = "success" | "error" | "info";

export function StaffWorkspace({
  data,
  categories,
  loading,
  onRefresh,
  onToast,
}: {
  data: StaffWorkspaceData | null;
  categories: LibraryCategory[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onToast: (message: string, kind?: ToastKind) => void;
}) {
  const [tab, setTab] = useState<"inventory" | "circulation">("inventory");
  const [query, setQuery] = useState("");
  const [expandedBook, setExpandedBook] = useState<number | null>(null);
  const [bookEditor, setBookEditor] = useState<BookSummary | null | false>(false);
  const [copyEditor, setCopyEditor] = useState<{ bookId: number; copy: BookCopyView | null } | null>(null);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [checkoutCopyId, setCheckoutCopyId] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const filteredBooks = useMemo(() => (data?.books ?? []).filter((book) => `${book.title} ${book.author} ${book.isbn} ${book.categoryName}`.toLowerCase().includes(query.toLowerCase())), [data?.books, query]);
  const selectableCopies = useMemo(() => (data?.books ?? []).flatMap((book) => book.copies.filter((copy) => copy.status === "available" || copy.status === "reserved").map((copy) => ({ ...copy, title: book.title }))), [data?.books]);

  async function saveBook(values: Record<string, unknown>) {
    const isEdit = Boolean(bookEditor);
    try {
      await apiPost("/api/staff", { ...values, action: isEdit ? "update-book" : "create-book", ...(isEdit ? { bookId: (bookEditor as BookSummary).id } : {}) });
      onToast(isEdit ? "Book details updated." : "New title added to the collection.", "success");
      setBookEditor(false);
      await onRefresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Could not save book details.", "error");
      throw error;
    }
  }

  async function saveCopy(values: Record<string, unknown>) {
    const isEdit = Boolean(copyEditor?.copy);
    try {
      await apiPost("/api/staff", {
        ...values,
        action: isEdit ? "update-copy" : "create-copy",
        ...(isEdit ? { copyId: copyEditor?.copy?.id } : { bookId: copyEditor?.bookId }),
      });
      onToast(isEdit ? "Copy location updated." : "New copy added and marked available.", "success");
      setCopyEditor(null);
      await onRefresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Could not save this copy.", "error");
      throw error;
    }
  }

  async function removeBook(book: BookSummary) {
    if (!window.confirm(`Remove “${book.title}” and its inventory history? Books with borrowed or reserved copies cannot be removed.`)) return;
    setActionBusy(book.id);
    try {
      const result = await apiPost<{ message: string }>("/api/staff", { action: "delete-book", bookId: book.id });
      onToast(result.message, "success");
      await onRefresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Could not remove this title.", "error");
    } finally {
      setActionBusy(null);
    }
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckoutError("");
    setCheckoutBusy(true);
    try {
      const result = await apiPost<{ message: string }>("/api/staff", { action: "checkout", email: checkoutEmail, copyId: Number(checkoutCopyId) });
      setCheckoutEmail("");
      setCheckoutCopyId("");
      onToast(result.message, "success");
      await onRefresh();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not check out this copy.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function returnLoan(loan: LoanView) {
    setActionBusy(loan.id);
    try {
      const result = await apiPost<{ message: string }>("/api/staff", { action: "return", loanId: loan.id });
      onToast(result.message, "success");
      await onRefresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Could not record this return.", "error");
    } finally {
      setActionBusy(null);
    }
  }

  async function cancelReservation(reservation: StaffReservation) {
    setActionBusy(reservation.id);
    try {
      const result = await apiFetch<{ message: string }>("/api/reservations", { method: "DELETE", body: JSON.stringify({ reservationId: reservation.id }) });
      onToast(result.message, "success");
      await onRefresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Could not cancel this hold.", "error");
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <section className="workspace staff-workspace">
      <div className="workspace-heading">
        <div><p className="eyebrow">LIBRARIAN WORKSPACE</p><h1>Library desk<span>.</span></h1><p>Keep the collection accurate and the circulation moving.</p></div>
        <div className="staff-status"><span className="status-live-dot" /><span><strong>Live inventory</strong><small>Availability refreshes as copies move</small></span></div>
      </div>

      <div className="staff-metrics">
        <Metric icon={<BookOpen size={17} />} label="Titles" value={data?.metrics.titles ?? "—"} />
        <Metric icon={<Building2 size={17} />} label="Physical copies" value={data?.metrics.copies ?? "—"} />
        <Metric icon={<Check size={17} />} label="On shelf" value={data?.metrics.available ?? "—"} accent />
        <Metric icon={<UsersRound size={17} />} label="On loan" value={data?.metrics.borrowed ?? "—"} />
        <Metric icon={<CalendarClock size={17} />} label="On hold" value={data?.metrics.reserved ?? "—"} />
      </div>

      <div className="workspace-tabs" role="tablist" aria-label="Librarian tools">
        <button className={tab === "inventory" ? "workspace-tab active" : "workspace-tab"} onClick={() => setTab("inventory")}><Building2 size={16} /> Inventory</button>
        <button className={tab === "circulation" ? "workspace-tab active" : "workspace-tab"} onClick={() => setTab("circulation")}><ClipboardList size={16} /> Circulation <span>{(data?.activeLoans.length ?? 0) + (data?.activeReservations.length ?? 0)}</span></button>
      </div>

      {tab === "inventory" ? (
        <div className="staff-content">
          <div className="inventory-toolbar"><div><h2>Collection inventory</h2><p>Manage bibliographic records, physical copies, and shelf locations.</p></div><div className="inventory-actions"><label className="search-compact"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a title or ISBN" /></label><button className="button button-primary" onClick={() => setBookEditor(null)}><Plus size={16} /> Add a book</button></div></div>
          {loading && !data ? <div className="loading-card"><LoaderCircle className="spin" size={19} /> Loading inventory…</div> : null}
          {!loading && filteredBooks.length === 0 ? <EmptyState title={query ? "No matching titles" : "Inventory is empty"} detail={query ? "Try another title, author, or ISBN." : "Add the first book to start building the collection."} /> : null}
          <div className="inventory-list">
            {filteredBooks.map((book) => (
              <article className="inventory-card" key={book.id}>
                <div className="inventory-book-row">
                  <BookCover book={book} className="inventory-cover" />
                  <div className="inventory-book-info"><span className="category-label">{book.categoryName}</span><h3>{book.title}</h3><p>{book.author}</p><small>ISBN {book.isbn}</small></div>
                  <div className="inventory-counts"><span><strong>{book.copiesOwned}</strong> total</span><span className="count-available"><strong>{book.availableCopies}</strong> available</span><span><strong>{book.borrowedCopies}</strong> loaned</span><span><strong>{book.reservedCopies}</strong> held</span></div>
                  <div className="inventory-row-actions"><button className="icon-action" title="Edit book" aria-label={`Edit ${book.title}`} onClick={() => setBookEditor(book)}><Pencil size={15} /></button><button className="icon-action" title="Remove book" aria-label={`Remove ${book.title}`} disabled={actionBusy === book.id} onClick={() => void removeBook(book)}>{actionBusy === book.id ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}</button><button className="button button-small button-outline" onClick={() => setCopyEditor({ bookId: book.id, copy: null })}><PackagePlus size={15} /> Add copy</button><button className={`expand-copies ${expandedBook === book.id ? "expanded" : ""}`} aria-label="Show copy locations" onClick={() => setExpandedBook(expandedBook === book.id ? null : book.id)}><ChevronDown size={17} /></button></div>
                </div>
                {expandedBook === book.id ? (
                  <div className="inventory-copies">
                    <div className="inventory-copy-heading"><span>Individual copies & exact locations</span><span>{book.copies.length} {book.copies.length === 1 ? "copy" : "copies"}</span></div>
                    {book.copies.length === 0 ? <p className="copy-empty">No physical copies have been added.</p> : book.copies.map((copy) => <div className="inventory-copy-row" key={copy.id}><div className="copy-row-id"><span className="copy-dot" /><strong>{copy.barcode}</strong><StatusBadge status={copy.status} /></div><div className="copy-row-location"><MapPin size={14} />{copy.location}</div><button className="text-button" onClick={() => setCopyEditor({ bookId: book.id, copy })}><Pencil size={14} /> Edit copy</button></div>)}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "circulation" ? (
        <div className="staff-content circulation-content">
          <div className="circulation-top-grid">
            <form className="checkout-card" onSubmit={checkout}>
              <div className="profile-card-heading"><span className="profile-icon"><BookOpen size={18} /></span><div><h2>Check out a copy</h2><p>Loans are due back in 21 days.</p></div></div>
              {checkoutError ? <div className="inline-error" role="alert">{checkoutError}</div> : null}
              <label className="field-label">Student college email<input type="email" value={checkoutEmail} onChange={(event) => setCheckoutEmail(event.target.value)} placeholder={`student@${emailDomain}`} maxLength={320} required /></label>
              <label className="field-label">Copy to check out<select value={checkoutCopyId} onChange={(event) => setCheckoutCopyId(event.target.value)} required><option value="">Select an available or reserved copy…</option>{selectableCopies.map((copy) => <option value={copy.id} key={copy.id}>{copy.title} · {copy.barcode} · {copy.status === "reserved" ? "reserved (match the student)" : "available"}</option>)}</select></label>
              <button className="button button-primary" type="submit" disabled={checkoutBusy || selectableCopies.length === 0}>{checkoutBusy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}Record checkout</button>
            </form>
            <div className="circulation-note"><span className="circulation-note-icon"><CalendarClock size={19} /></span><p className="eyebrow">RESERVATION WINDOW</p><h3>24 hours to collect</h3><p>Active holds expire automatically. The copy returns to the available shelf once its hold expires or is cancelled.</p><button className="text-button" onClick={() => void onRefresh()}><RotateCcw size={14} /> Refresh circulation status</button></div>
          </div>

          <section className="circulation-section"><div className="circulation-section-heading"><div><h2>Current loans</h2><p>Check a returned copy back into available inventory.</p></div><span className="table-count">{data?.activeLoans.length ?? 0} active</span></div>
            {!loading && (data?.activeLoans.length ?? 0) === 0 ? <EmptyState compact title="No active loans" detail="Current checkouts will appear here." /> : null}
            <div className="circulation-list">{data?.activeLoans.map((loan) => <article className="circulation-row" key={loan.id}><BookCover book={loan.book} className="circulation-cover" /><div className="circulation-book-cell"><strong>{loan.book.title}</strong><span>{loan.book.author} · {loan.copy.barcode}</span></div><div className="circulation-person"><strong>{loan.borrower?.name ?? "Student"}</strong><span>{loan.borrower?.email}</span></div><div className="circulation-due"><span>Due {formatDateTime(loan.dueAt)}</span><StatusBadge status={loan.copy.status} /></div><button className="button button-small button-outline" disabled={actionBusy === loan.id} onClick={() => void returnLoan(loan)}>{actionBusy === loan.id ? <LoaderCircle size={14} className="spin" /> : <RotateCcw size={14} />}Return</button></article>)}</div>
          </section>

          <section className="circulation-section"><div className="circulation-section-heading"><div><h2>Reservation holds</h2><p>Find who a copy is being held for and when it expires.</p></div><span className="table-count">{data?.activeReservations.length ?? 0} active</span></div>
            {!loading && (data?.activeReservations.length ?? 0) === 0 ? <EmptyState compact title="No active holds" detail="Student reservations will appear here until collected or expired." /> : null}
            <div className="circulation-list">{data?.activeReservations.map((reservation) => <article className="circulation-row reservation-staff-row" key={reservation.id}><BookCover book={reservation.book} className="circulation-cover" /><div className="circulation-book-cell"><strong>{reservation.book.title}</strong><span>{reservation.book.author} · {reservation.copy.barcode}</span></div><div className="circulation-person"><strong>{reservation.borrower?.name ?? "Student"}</strong><span>{reservation.borrower?.email ?? "Student account"}</span></div><div className="circulation-due"><span>Expires {formatDateTime(reservation.expiresAt)}</span><StatusBadge status="active" /></div><button className="button button-small button-quiet-danger" disabled={actionBusy === reservation.id} onClick={() => void cancelReservation(reservation)}>{actionBusy === reservation.id ? <LoaderCircle size={14} className="spin" /> : <X size={14} />}Cancel</button></article>)}</div>
          </section>
        </div>
      ) : null}

      {bookEditor !== false ? <BookEditorModal book={bookEditor} categories={categories} onClose={() => setBookEditor(false)} onSave={saveBook} /> : null}
      {copyEditor ? <CopyEditorModal bookId={copyEditor.bookId} copy={copyEditor.copy} onClose={() => setCopyEditor(null)} onSave={saveCopy} /> : null}
    </section>
  );
}

function Metric({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: number | string; accent?: boolean }) {
  return <div className={`staff-metric ${accent ? "metric-accent" : ""}`}><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong></div>;
}

function BookEditorModal({ book, categories, onClose, onSave }: { book: BookSummary | null; categories: LibraryCategory[]; onClose: () => void; onSave: (values: Record<string, unknown>) => Promise<void> }) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [isbn, setIsbn] = useState(book?.isbn ?? "");
  const [categoryId, setCategoryId] = useState(String(book?.categoryId ?? categories[0]?.id ?? ""));
  const [description, setDescription] = useState(book?.description ?? "");
  const [coverUrl, setCoverUrl] = useState(book?.coverUrl ?? "");
  const [publishedYear, setPublishedYear] = useState(book?.publishedYear ? String(book.publishedYear) : "");
  const [publisher, setPublisher] = useState(book?.publisher ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try { await onSave({ title, author, isbn, categoryId: Number(categoryId), description, coverUrl, publishedYear, publisher }); }
    catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Could not save this book."); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="management-dialog" role="dialog" aria-modal="true" aria-labelledby="book-editor-title"><button className="dialog-close" onClick={onClose} aria-label="Close book editor"><X size={19} /></button><p className="eyebrow">COLLECTION MANAGEMENT</p><h2 id="book-editor-title">{book ? "Edit book details" : "Add a book"}</h2><p className="management-intro">Add a bibliographic record, then add one or more physical copies with shelf locations.</p>{error ? <div className="inline-error" role="alert">{error}</div> : null}<form className="management-form" onSubmit={submit}><div className="form-two-columns"><label className="field-label">Book title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={240} required /></label><label className="field-label">Author<input value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={180} required /></label></div><div className="form-three-columns"><label className="field-label">ISBN<input value={isbn} onChange={(event) => setIsbn(event.target.value)} maxLength={24} required /></label><label className="field-label">Category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label className="field-label">Published year<input inputMode="numeric" value={publishedYear} onChange={(event) => setPublishedYear(event.target.value)} placeholder="Optional" maxLength={4} /></label></div><div className="form-two-columns"><label className="field-label">Publisher <span className="optional-label">optional</span><input value={publisher} onChange={(event) => setPublisher(event.target.value)} maxLength={180} /></label><label className="field-label">Cover image URL <span className="optional-label">optional</span><input type="url" value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} placeholder="https://…" /></label></div><label className="field-label">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={8000} placeholder="A short description for students" /></label><div className="management-form-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{book ? "Save changes" : "Add title"}</button></div></form></section></div>;
}

function CopyEditorModal({ bookId, copy, onClose, onSave }: { bookId: number; copy: BookCopyView | null; onClose: () => void; onSave: (values: Record<string, unknown>) => Promise<void> }) {
  const [barcode, setBarcode] = useState(copy?.barcode ?? "");
  const [building, setBuilding] = useState(copy?.building ?? "Founders Library");
  const [floor, setFloor] = useState(copy?.floor ?? "1");
  const [section, setSection] = useState(copy?.section ?? "General collection");
  const [shelf, setShelf] = useState(copy?.shelf ?? "A1");
  const [rack, setRack] = useState(copy?.rack ?? "Rack 1");
  const [status, setStatus] = useState(copy?.status ?? "available");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canSetStatus = !copy || copy.status === "available" || copy.status === "maintenance";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try { await onSave({ bookId, barcode, building, floor, section, shelf, rack, ...(canSetStatus ? { status } : {}) }); }
    catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Could not save this copy."); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="management-dialog copy-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="copy-editor-title"><button className="dialog-close" onClick={onClose} aria-label="Close copy editor"><X size={19} /></button><p className="eyebrow">INDIVIDUAL COPY</p><h2 id="copy-editor-title">{copy ? "Edit copy & location" : "Add a physical copy"}</h2><p className="management-intro">Record the exact campus location students will use to find this copy.</p>{error ? <div className="inline-error" role="alert">{error}</div> : null}<form className="management-form" onSubmit={submit}>{!copy ? <label className="field-label">Barcode <span className="optional-label">leave blank to generate one</span><input value={barcode} onChange={(event) => setBarcode(event.target.value)} maxLength={64} placeholder="Auto-generated if blank" /></label> : <div className="barcode-display">Barcode <strong>{copy.barcode}</strong><StatusBadge status={copy.status} /></div>}<div className="form-two-columns"><label className="field-label">Building / library<input value={building} onChange={(event) => setBuilding(event.target.value)} maxLength={120} required /></label><label className="field-label">Floor<input value={floor} onChange={(event) => setFloor(event.target.value)} maxLength={40} required /></label></div><label className="field-label">Section<input value={section} onChange={(event) => setSection(event.target.value)} maxLength={100} required /></label><div className="form-two-columns"><label className="field-label">Shelf<input value={shelf} onChange={(event) => setShelf(event.target.value)} maxLength={80} required /></label><label className="field-label">Rack<input value={rack} onChange={(event) => setRack(event.target.value)} maxLength={80} required /></label></div>{canSetStatus ? <label className="field-label">Copy status<select value={status} onChange={(event) => setStatus(event.target.value as "available" | "maintenance")}><option value="available">Available on shelf</option><option value="maintenance">In maintenance</option></select></label> : <p className="field-hint">A borrowed or reserved copy’s circulation status can only be changed by recording a return or cancelling its hold.</p>}<div className="management-form-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{copy ? "Save copy" : "Add copy"}</button></div></form></section></div>;
}
