"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { BookMarked, BookOpen, Check, Clock3, KeyRound, LoaderCircle, Mail, MapPin, RotateCcw, UserRound } from "lucide-react";
import { apiFetch, apiPost } from "@/lib/client-api";
import type { LoanView, ReservationView, SessionUser } from "@/lib/types";
import { BookCover, EmptyState, formatDateTime, formatTimeRemaining, StatusBadge } from "@/app/components/ui";

export type StudentShelfData = { reservations: ReservationView[]; loans: LoanView[] };
type ToastKind = "success" | "error" | "info";

export function StudentShelf({
  user,
  shelf,
  loading,
  onRefresh,
  onToast,
  onUserUpdate,
}: {
  user: SessionUser;
  shelf: StudentShelfData | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onToast: (message: string, kind?: ToastKind) => void;
  onUserUpdate: (user: SessionUser) => void;
}) {
  const [tab, setTab] = useState<"loans" | "reservations" | "profile">("loans");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [name, setName] = useState(user.name);
  const [studentId, setStudentId] = useState(user.studentId ?? "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    setName(user.name);
    setStudentId(user.studentId ?? "");
  }, [user.name, user.studentId]);

  async function cancelReservation(reservation: ReservationView) {
    setBusyId(reservation.id);
    try {
      const result = await apiFetch<{ message: string }>("/api/reservations", {
        method: "DELETE",
        body: JSON.stringify({ reservationId: reservation.id }),
      });
      onToast(result.message, "success");
      await onRefresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Could not cancel this reservation.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setProfileBusy(true);
    try {
      const result = await apiPost<{ user: SessionUser }>("/api/auth", { action: "profile", name, studentId }, "PATCH");
      onUserUpdate(result.user);
      onToast("Your profile has been updated.", "success");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not update your profile.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordBusy(true);
    try {
      const result = await apiPost<{ user: SessionUser }>("/api/auth", { action: "change-password", currentPassword, newPassword }, "PATCH");
      onUserUpdate(result.user);
      setCurrentPassword("");
      setNewPassword("");
      onToast("Your password has been changed.", "success");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Could not change your password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  const activeReservations = shelf?.reservations.filter((item) => item.status === "active") ?? [];
  const previousReservations = shelf?.reservations.filter((item) => item.status !== "active") ?? [];
  const activeLoans = shelf?.loans.filter((item) => !item.returnedAt) ?? [];
  const returnedLoans = shelf?.loans.filter((item) => item.returnedAt) ?? [];

  return (
    <section className="workspace student-workspace">
      <div className="workspace-heading">
        <div><p className="eyebrow">YOUR LIBRARY ACCOUNT</p><h1>My shelf<span>.</span></h1><p>Everything you’ve borrowed and saved, together in one place.</p></div>
        <div className="member-card"><span className="member-avatar"><UserRound size={19} /></span><span><strong>{user.name}</strong><small>{user.studentId || "Student member"}</small></span><span className="member-mark"><BookOpen size={19} /></span></div>
      </div>

      <div className="workspace-tabs" role="tablist" aria-label="My shelf sections">
        <button className={tab === "loans" ? "workspace-tab active" : "workspace-tab"} onClick={() => setTab("loans")}><BookOpen size={16} /> Loans <span>{activeLoans.length}</span></button>
        <button className={tab === "reservations" ? "workspace-tab active" : "workspace-tab"} onClick={() => setTab("reservations")}><BookMarked size={16} /> Reservations <span>{activeReservations.length}</span></button>
        <button className={tab === "profile" ? "workspace-tab active" : "workspace-tab"} onClick={() => setTab("profile")}><UserRound size={16} /> Profile</button>
      </div>

      {tab === "loans" ? (
        <div className="shelf-content">
          <div className="shelf-list-heading"><div><h2>Checked out</h2><p>Your current loans and due dates.</p></div><button className="text-button" onClick={() => void onRefresh()}><RotateCcw size={15} /> Refresh status</button></div>
          {loading && !shelf ? <div className="loading-card"><LoaderCircle className="spin" size={20} /> Loading your loans…</div> : null}
          {!loading && activeLoans.length === 0 ? <EmptyState title="Nothing checked out" detail="When a librarian checks out a book to you, it will show up here with its due date." /> : null}
          {activeLoans.map((loan) => {
            const overdue = new Date(loan.dueAt).getTime() < Date.now();
            return <LoanCard key={loan.id} loan={loan} overdue={overdue} />;
          })}
          {returnedLoans.length > 0 ? <div className="history-section"><h3>Recently returned</h3>{returnedLoans.slice(0, 5).map((loan) => <LoanCard key={loan.id} loan={loan} returned />)}</div> : null}
        </div>
      ) : null}

      {tab === "reservations" ? (
        <div className="shelf-content">
          <div className="shelf-list-heading"><div><h2>Reservations</h2><p>Copies are held for exactly 24 hours after you reserve them.</p></div><span className="reservation-rule"><Clock3 size={15} /> 24-hour hold</span></div>
          {loading && !shelf ? <div className="loading-card"><LoaderCircle className="spin" size={20} /> Loading your reservations…</div> : null}
          {!loading && activeReservations.length === 0 ? <EmptyState title="No active holds" detail="Browse the collection and reserve an available copy. Its exact shelf location will appear here." /> : null}
          {activeReservations.map((reservation) => (
            <article className="reservation-card" key={reservation.id}>
              <BookCover book={reservation.book} className="reservation-cover" />
              <div className="reservation-info"><span className="category-label">{reservation.book.categoryName}</span><h3>{reservation.book.title}</h3><p className="book-author">{reservation.book.author}</p><p className="location-copy"><MapPin size={14} /> {reservation.copy.location}</p><span className="reservation-expiry"><Clock3 size={14} /><strong>{formatTimeRemaining(reservation.expiresAt)}</strong> · expires {formatDateTime(reservation.expiresAt)}</span></div>
              <div className="reservation-actions"><StatusBadge status={reservation.status} /><button className="button button-small button-quiet-danger" disabled={busyId === reservation.id} onClick={() => void cancelReservation(reservation)}>{busyId === reservation.id ? <LoaderCircle size={15} className="spin" /> : null}Cancel hold</button></div>
            </article>
          ))}
          {previousReservations.length > 0 ? <div className="history-section"><h3>Past reservations</h3>{previousReservations.slice(0, 6).map((reservation) => <div className="past-reservation-row" key={reservation.id}><div><strong>{reservation.book.title}</strong><span>{formatDateTime(reservation.createdAt)}</span></div><StatusBadge status={reservation.status} /></div>)}</div> : null}
        </div>
      ) : null}

      {tab === "profile" ? (
        <div className="profile-grid">
          <form className="profile-card" onSubmit={saveProfile}>
            <div className="profile-card-heading"><span className="profile-icon"><UserRound size={18} /></span><div><h2>Profile details</h2><p>Keep your campus information up to date.</p></div></div>
            {profileError ? <div className="inline-error" role="alert">{profileError}</div> : null}
            <label className="field-label">Full name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={140} required /></label>
            <label className="field-label">Student ID<input value={studentId} onChange={(event) => setStudentId(event.target.value)} maxLength={48} placeholder="Add your student ID" /></label>
            <label className="field-label">Email address<span className="field-with-icon"><Mail size={16} /><input value={user.email} readOnly /></span><small className="field-hint">Email changes are managed by a library administrator.</small></label>
            <div className="profile-readonly"><span>Account role</span><strong>{user.role === "student" ? "Student" : user.role === "librarian" ? "Librarian" : "Administrator"}</strong></div>
            <button className="button button-primary" type="submit" disabled={profileBusy}>{profileBusy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}Save profile</button>
          </form>
          <form className="profile-card" onSubmit={changePassword}>
            <div className="profile-card-heading"><span className="profile-icon"><KeyRound size={18} /></span><div><h2>Change password</h2><p>Choose a unique password with at least 10 characters.</p></div></div>
            {passwordError ? <div className="inline-error" role="alert">{passwordError}</div> : null}
            <label className="field-label">Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
            <label className="field-label">New password<input type="password" autoComplete="new-password" minLength={10} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
            <div className="password-note"><KeyRound size={16} /><span>Your other active sign-in sessions will be invalidated when you change your password.</span></div>
            <button className="button button-outline" type="submit" disabled={passwordBusy}>{passwordBusy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}Update password</button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function LoanCard({ loan, overdue = false, returned = false }: { loan: LoanView; overdue?: boolean; returned?: boolean }) {
  return (
    <article className="loan-card">
      <BookCover book={loan.book} className="loan-cover" />
      <div className="loan-book-info"><span className="category-label">{loan.book.categoryName}</span><h3>{loan.book.title}</h3><p className="book-author">{loan.book.author}</p><p className="location-copy"><MapPin size={14} /> Copy location: {loan.copy.location}</p><small>Barcode {loan.copy.barcode}</small></div>
      <div className="loan-due"><span>{returned ? "Returned" : overdue ? "Past due" : "Due date"}</span><strong className={overdue && !returned ? "overdue-text" : ""}>{formatDateTime(returned ? loan.returnedAt ?? loan.dueAt : loan.dueAt)}</strong>{!returned ? <StatusBadge status="borrowed" /> : <StatusBadge status="collected" />}</div>
    </article>
  );
}
