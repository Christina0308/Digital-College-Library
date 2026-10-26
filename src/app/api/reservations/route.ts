import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookCopies, reservations } from "@/db/schema";
import { ensureDemoData, expireReservations, getBookDetail, getStudentShelf } from "@/lib/library";
import { getCurrentUser, resolveSession } from "@/lib/security";

function jsonError(message: string, status = 400, reason?: string) {
  return Response.json({ error: message, ...(reason ? { reason } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}

const sessionMessages: Record<string, string> = {
  "no-credential": "Your browser did not send a sign-in credential. Sign in again to reserve this copy.",
  "unknown-session": "We could not find that sign-in session. Please sign in again.",
  expired: "Your sign-in session expired. Sign in again to continue.",
  revoked: "That sign-in was ended. Please sign in again.",
  "inactive-account": "This account is inactive. Please contact the library team.",
};

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return jsonError("Sign in to view your library shelf.", 401);
  try {
    await ensureDemoData();
    const shelf = await getStudentShelf(currentUser.id);
    return Response.json(shelf, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Shelf query failed:", error);
    return jsonError("Your shelf is temporarily unavailable.", 500);
  }
}

export async function POST(request: Request) {
  const session = await resolveSession();
  const currentUser = session.user;
  if (!currentUser) {
    const reason = session.reason ?? "no-credential";
    return jsonError(sessionMessages[reason] ?? "Sign in to reserve a book.", 401, reason);
  }
  if (currentUser.role !== "student") return jsonError("Reservations are available to student accounts.", 403);
  let body: { copyId?: unknown };
  try {
    body = await request.json() as { copyId?: unknown };
  } catch {
    return jsonError("Please select a valid copy.");
  }
  const copyId = Number(body.copyId);
  if (!Number.isInteger(copyId) || copyId < 1) return jsonError("Please select a valid copy.");

  try {
    await ensureDemoData();
    await expireReservations();
    const { reservationId, bookId } = await db.transaction(async (tx) => {
      const [copy] = await tx.select({ id: bookCopies.id, bookId: bookCopies.bookId, status: bookCopies.status })
        .from(bookCopies).where(eq(bookCopies.id, copyId)).for("update").limit(1);
      if (!copy) throw new Error("COPY_NOT_FOUND");
      if (copy.status !== "available") throw new Error("COPY_NOT_AVAILABLE");
      const now = new Date();
      const [reservation] = await tx.insert(reservations).values({
        userId: currentUser.id,
        copyId,
        status: "active",
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      }).returning({ id: reservations.id });
      await tx.update(bookCopies).set({ status: "reserved", updatedAt: now })
        .where(and(eq(bookCopies.id, copyId), eq(bookCopies.status, "available")));
      return { reservationId: reservation.id, bookId: copy.bookId };
    });
    const shelf = await getStudentShelf(currentUser.id);
    const reservation = shelf.reservations.find((item) => item.id === reservationId);
    const book = await getBookDetail(bookId, currentUser.id);
    return Response.json({
      reservation,
      book,
      message: `Reserved for you for 24 hours${reservation ? ` · collect by ${new Date(reservation.expiresAt).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}.`,
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "COPY_NOT_FOUND") return jsonError("That copy could not be found.", 404);
    if (reason === "COPY_NOT_AVAILABLE" || (error as { code?: string })?.code === "23505") {
      return jsonError("That copy is no longer available. Please choose another copy.", 409);
    }
    console.error("Reservation request failed:", error);
    return jsonError("We could not reserve that copy. Please try again.", 500);
  }
}

export async function DELETE(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return jsonError("Sign in to manage reservations.", 401);
  let body: { reservationId?: unknown };
  try {
    body = await request.json() as { reservationId?: unknown };
  } catch {
    return jsonError("Please select a reservation.");
  }
  const reservationId = Number(body.reservationId);
  if (!Number.isInteger(reservationId) || reservationId < 1) return jsonError("Please select a reservation.");

  try {
    await expireReservations();
    const result = await db.transaction(async (tx) => {
      const [reservation] = await tx.select({ id: reservations.id, userId: reservations.userId, copyId: reservations.copyId, status: reservations.status })
        .from(reservations).where(eq(reservations.id, reservationId)).for("update").limit(1);
      if (!reservation) return "NOT_FOUND";
      if (reservation.userId !== currentUser.id && currentUser.role === "student") return "FORBIDDEN";
      if (reservation.status !== "active") return "NOT_ACTIVE";
      const now = new Date();
      await tx.update(reservations).set({ status: "cancelled", updatedAt: now }).where(eq(reservations.id, reservationId));
      await tx.update(bookCopies).set({ status: "available", updatedAt: now })
        .where(and(eq(bookCopies.id, reservation.copyId), eq(bookCopies.status, "reserved")));
      return "CANCELLED";
    });
    if (result === "NOT_FOUND") return jsonError("That reservation could not be found.", 404);
    if (result === "FORBIDDEN") return jsonError("You can only cancel your own reservations.", 403);
    if (result === "NOT_ACTIVE") return jsonError("That reservation is no longer active.", 409);
    return Response.json({ ok: true, message: "Reservation cancelled. The copy is available again." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Reservation cancellation failed:", error);
    return jsonError("We could not cancel that reservation. Please try again.", 500);
  }
}
