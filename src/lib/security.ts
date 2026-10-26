import "server-only";

import { randomBytes, scrypt as nodeScrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { and, eq, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { SessionUser } from "@/lib/types";

const scrypt = promisify(nodeScrypt);
const sessionCookie = "college_library_session";
const sessionLifetimeSeconds = 60 * 60 * 24 * 14;

export type SessionFailure = "no-credential" | "unknown-session" | "expired" | "revoked" | "inactive-account";
export type SessionResult = { user: SessionUser | null; reason?: SessionFailure; sessionId?: number };

export function publicUser(user: {
  id: number;
  name: string;
  email: string;
  studentId: string | null;
  role: SessionUser["role"];
}): SessionUser {
  return { id: user.id, name: user.name, email: user.email, studentId: user.studentId, role: user.role };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length === 0) return false;
  const derived = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Embedded previews run in a cross-site iframe, where SameSite=Lax cookies are dropped.
 * The cookie is therefore SameSite=None; Secure over HTTPS, and the same opaque token is
 * returned to the client so it can authenticate with a bearer header when cookies are blocked.
 */
function sessionCookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    secure,
    path: "/",
  };
}

export async function createSession(userId: number) {
  const [user] = await db.select({ active: users.active }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.active) throw new Error("Cannot issue a session for an inactive account.");

  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt: new Date(Date.now() + sessionLifetimeSeconds * 1000),
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookie, token, { ...sessionCookieOptions(), maxAge: sessionLifetimeSeconds });
  return token;
}

async function readSessionToken() {
  const headerList = await headers();
  const authorization = headerList.get("authorization");
  if (authorization && authorization.toLowerCase().startsWith("bearer ")) {
    const bearer = authorization.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookieStore = await cookies();
  return cookieStore.get(sessionCookie)?.value;
}

/** Resolves the caller and, when unauthenticated, explains exactly why. */
export async function resolveSession(): Promise<SessionResult> {
  const token = await readSessionToken();
  if (!token) return { user: null, reason: "no-credential" };

  const [session] = await db.select({
    id: sessions.id,
    userId: sessions.userId,
    expiresAt: sessions.expiresAt,
    revokedAt: sessions.revokedAt,
  }).from(sessions).where(eq(sessions.tokenHash, hashSessionToken(token))).limit(1);

  if (!session) return { user: null, reason: "unknown-session" };
  if (session.revokedAt) return { user: null, reason: "revoked" };
  if (session.expiresAt.getTime() <= Date.now()) return { user: null, reason: "expired" };

  const [user] = await db.select({
    id: users.id, name: users.name, email: users.email,
    studentId: users.studentId, role: users.role, active: users.active,
  }).from(users).where(eq(users.id, session.userId)).limit(1);

  if (!user) return { user: null, reason: "unknown-session" };
  if (!user.active) return { user: null, reason: "inactive-account" };

  return { user: publicUser(user), sessionId: session.id };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    return (await resolveSession()).user;
  } catch {
    return null;
  }
}

/** Ends only the caller's current session (other devices stay signed in). */
export async function destroySession() {
  try {
    const token = await readSessionToken();
    if (token) {
      await db.update(sessions).set({ revokedAt: new Date() })
        .where(and(eq(sessions.tokenHash, hashSessionToken(token)), isNull(sessions.revokedAt)));
    }
  } finally {
    const cookieStore = await cookies();
    cookieStore.set(sessionCookie, "", { ...sessionCookieOptions(), maxAge: 0 });
  }
}

/** Revokes a user's sessions, optionally keeping the one just issued. */
export async function revokeUserSessions(userId: number, keepToken?: string) {
  const keepHash = keepToken ? hashSessionToken(keepToken) : null;
  const condition = keepHash
    ? and(eq(sessions.userId, userId), isNull(sessions.revokedAt), ne(sessions.tokenHash, keepHash))
    : and(eq(sessions.userId, userId), isNull(sessions.revokedAt));
  await db.update(sessions).set({ revokedAt: new Date() }).where(condition);
}

export async function purgeExpiredSessions() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await db.delete(sessions).where(lt(sessions.expiresAt, cutoff));
}
