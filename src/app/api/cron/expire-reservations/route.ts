import { timingSafeEqual } from "node:crypto";
import { expireReservations } from "@/lib/library";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Reservation-expiry schedule is not configured." }, { status: 503 });
  const authorization = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(authorization);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const expired = await expireReservations();
    return Response.json({ ok: true, expired, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Scheduled reservation expiry failed:", error);
    return Response.json({ error: "Reservation expiry could not be completed." }, { status: 500 });
  }
}
