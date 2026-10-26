"use client";

import { useState } from "react";
import { BookOpen, Search } from "lucide-react";
import type { BookSummary } from "@/lib/types";

export function BookCover({ book, className = "" }: { book: Pick<BookSummary, "id" | "title" | "author" | "coverUrl">; className?: string }) {
  const [broken, setBroken] = useState(false);
  const tone = Math.abs(book.id) % 5;
  return (
    <div className={`book-cover cover-tone-${tone} ${className}`} role="img" aria-label={`Cover of ${book.title}`}>
      {book.coverUrl && !broken ? (
        <img src={book.coverUrl} alt={`Cover of ${book.title}`} loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <div className="cover-placeholder">
          <BookOpen size={24} strokeWidth={1.4} aria-hidden="true" />
          <span>{book.title}</span>
          <small>{book.author}</small>
        </div>
      )}
      <span className="cover-shade" aria-hidden="true" />
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    available: "On shelf",
    borrowed: "Checked out",
    reserved: "Reserved",
    maintenance: "In repair",
    active: "Active",
    collected: "Collected",
    cancelled: "Cancelled",
    expired: "Expired",
  };
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>;
}

export function EmptyState({ title, detail, compact = false }: { title: string; detail: string; compact?: boolean }) {
  return (
    <div className={`empty-state ${compact ? "empty-state-compact" : ""}`}>
      <span className="empty-state-icon"><Search size={21} strokeWidth={1.7} aria-hidden="true" /></span>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatTimeRemaining(value: string) {
  const remaining = new Date(value).getTime() - Date.now();
  if (remaining <= 0) return "Expiring now";
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  if (hours < 1) return `${Math.max(1, minutes)} min left`;
  if (hours < 24) return `${hours}h ${minutes}m left`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h left`;
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "L";
}
