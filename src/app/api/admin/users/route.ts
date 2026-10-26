import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, getCurrentUser, hashPassword, revokeUserSessions } from "@/lib/security";
import type { UserRole } from "@/lib/types";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function isAdmin(role: string) {
  return role === "admin";
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return jsonError("Sign in to manage accounts.", 401);
  if (!isAdmin(currentUser.role)) return jsonError("Administrator access is required.", 403);
  try {
    const data = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      studentId: users.studentId,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt));
    return Response.json({ users: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin account query failed:", error);
    return jsonError("Account management is temporarily unavailable.", 500);
  }
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return jsonError("Sign in to manage accounts.", 401);
  if (!isAdmin(currentUser.role)) return jsonError("Administrator access is required.", 403);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return jsonError("Please send a valid request.");
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role;
  const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
  if (name.length < 2 || name.length > 140) return jsonError("Enter a name between 2 and 140 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return jsonError("Enter a valid email address.");
  if (password.length < 10 || password.length > 128) return jsonError("Use a temporary password with at least 10 characters.");
  if (role !== "student" && role !== "librarian" && role !== "admin") return jsonError("Choose a valid account role.");
  if (studentId.length > 48) return jsonError("Student ID must be 48 characters or fewer.");
  try {
    const [created] = await db.insert(users).values({
      name, email, passwordHash: await hashPassword(password), role: role as UserRole,
      studentId: studentId || null, active: true,
    }).returning({ id: users.id, name: users.name, email: users.email, studentId: users.studentId, role: users.role, active: users.active, createdAt: users.createdAt });
    return Response.json({ user: created }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") return jsonError("An account with that email already exists.", 409);
    console.error("Admin account creation failed:", error);
    return jsonError("We could not create that account. Please try again.", 500);
  }
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return jsonError("Sign in to manage accounts.", 401);
  if (!isAdmin(currentUser.role)) return jsonError("Administrator access is required.", 403);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return jsonError("Please send a valid request.");
  }
  const userId = Number(body.userId);
  if (!Number.isInteger(userId) || userId < 1) return jsonError("Choose a valid account.");
  const role = body.role;
  if (role !== undefined && role !== "student" && role !== "librarian" && role !== "admin") return jsonError("Choose a valid account role.");
  if (body.active !== undefined && typeof body.active !== "boolean") return jsonError("Account status must be active or inactive.");
  const name = body.name === undefined ? undefined : typeof body.name === "string" ? body.name.trim() : "";
  const studentId = body.studentId === undefined ? undefined : typeof body.studentId === "string" ? body.studentId.trim() : "";
  if (name !== undefined && (name.length < 2 || name.length > 140)) return jsonError("Enter a name between 2 and 140 characters.");
  if (studentId !== undefined && studentId.length > 48) return jsonError("Student ID must be 48 characters or fewer.");
  if (userId === currentUser.id && (body.active === false || (role !== undefined && role !== "admin"))) {
    return jsonError("You cannot deactivate or remove your own administrator access.", 409);
  }

  try {
    const [target] = await db.select({ id: users.id, role: users.role, active: users.active }).from(users).where(eq(users.id, userId)).limit(1);
    if (!target) return jsonError("That account could not be found.", 404);
    const willLoseAdmin = target.role === "admin" && target.active && (body.active === false || role === "student" || role === "librarian");
    if (willLoseAdmin) {
      const activeAdmins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.active, true)));
      if (activeAdmins.length <= 1) return jsonError("Keep at least one administrator active.", 409);
    }
    const values: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (role !== undefined) values.role = role as UserRole;
    if (body.active !== undefined) values.active = body.active as boolean;
    if (name !== undefined) values.name = name;
    if (studentId !== undefined) values.studentId = studentId || null;
    const [updated] = await db.update(users).set(values).where(eq(users.id, userId)).returning({
      id: users.id, name: users.name, email: users.email, studentId: users.studentId,
      role: users.role, active: users.active, createdAt: users.createdAt,
    });
    const token = userId === currentUser.id ? await createSession(updated.id) : undefined;
    // Access changes take effect immediately: drop the target's existing sessions.
    if (body.active === false || (role !== undefined && role !== target.role)) {
      await revokeUserSessions(userId, token);
    }
    return Response.json({ user: updated, token }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin account update failed:", error);
    return jsonError("We could not update that account. Please try again.", 500);
  }
}
