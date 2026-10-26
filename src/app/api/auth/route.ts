import { and, eq, gt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureDemoData } from "@/lib/library";
import { createSession, destroySession, hashPassword, hashResetToken, publicUser, revokeUserSessions, verifyPassword } from "@/lib/security";
import { getCurrentUser, resolveSession } from "@/lib/security";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

export async function GET() {
  try {
    await ensureDemoData();
    const session = await resolveSession();
    return Response.json({ user: session.user, reason: session.reason }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("Unable to load your account right now.", 500);
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return jsonError("Please send a valid request.");
  }

  const action = typeof body.action === "string" ? body.action : "";
  try {
    await ensureDemoData();

    if (action === "logout") {
      await destroySession();
      return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "register") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
      if (name.length < 2 || name.length > 140) return jsonError("Please enter your full name.");
      if (!isEmail(email)) return jsonError("Enter a valid college email address.");
      if (password.length < 10 || password.length > 128) return jsonError("Use a password with at least 10 characters.");
      if (studentId.length > 48) return jsonError("Student ID must be 48 characters or fewer.");

      const passwordHash = await hashPassword(password);
      const [created] = await db.insert(users).values({
        name,
        email,
        studentId: studentId || null,
        passwordHash,
        role: "student",
      }).returning({ id: users.id, name: users.name, email: users.email, studentId: users.studentId, role: users.role });
      const token = await createSession(created.id);
      return Response.json({ user: publicUser(created), token }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }

    if (action === "login") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (!isEmail(email) || !password) return jsonError("Enter your email and password.");
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !(await verifyPassword(password, user.passwordHash))) return jsonError("That email and password do not match.", 401);
      if (!user.active) return jsonError("This account is inactive. Please contact the library team.", 403);
      const token = await createSession(user.id);
      return Response.json({ user: publicUser(user), token }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "forgot") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!isEmail(email)) return jsonError("Enter the email address associated with your account.");
      const [user] = await db.select({ id: users.id, active: users.active }).from(users).where(eq(users.email, email)).limit(1);
      const responseBody: { message: string; resetUrl?: string; resetToken?: string } = {
        message: "If an active account matches that email, password reset instructions are on their way.",
      };
      if (!user?.active) return Response.json(responseBody, { headers: { "Cache-Control": "no-store" } });
      if (process.env.NODE_ENV === "production" && (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)) {
        console.error("Password reset requested without RESEND_API_KEY and MAIL_FROM configured.");
        return Response.json(responseBody, { headers: { "Cache-Control": "no-store" } });
      }

      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await db.update(users).set({
        passwordResetTokenHash: hashResetToken(token),
        passwordResetExpiresAt: expiresAt,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));
      const baseUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
      const resetUrl = `${baseUrl}/?reset=${encodeURIComponent(token)}`;

      if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
        const delivery = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.MAIL_FROM,
            to: [email],
            subject: "Reset your college library password",
            html: `<p>Use the secure link below to reset your library password. It expires in one hour.</p><p><a href="${resetUrl}">Reset my password</a></p><p>If you did not request this, you can ignore this email.</p>`,
          }),
        });
        if (!delivery.ok) {
          await db.update(users).set({ passwordResetTokenHash: null, passwordResetExpiresAt: null, updatedAt: new Date() }).where(eq(users.id, user.id));
          console.error("Password reset email delivery failed:", await delivery.text());
          return jsonError("We could not send the reset email just now. Please try again later.", 502);
        }
      } else if (process.env.NODE_ENV !== "production") {
        responseBody.message = "Demo reset link created. It is valid for one hour and can only be used once.";
        responseBody.resetUrl = resetUrl;
        responseBody.resetToken = token;
      } else {
        console.error("Password reset link could not be delivered.");
      }
      return Response.json(responseBody, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "reset") {
      const token = typeof body.token === "string" ? body.token : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (token.length < 20) return jsonError("That reset link is invalid or expired.");
      if (password.length < 10 || password.length > 128) return jsonError("Use a password with at least 10 characters.");
      const passwordHash = await hashPassword(password);
      const now = new Date();
      const [updated] = await db.update(users).set({
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        updatedAt: now,
      }).where(and(
        eq(users.passwordResetTokenHash, hashResetToken(token)),
        gt(users.passwordResetExpiresAt, now),
        eq(users.active, true),
      )).returning({ id: users.id, name: users.name, email: users.email, studentId: users.studentId, role: users.role });
      if (!updated) return jsonError("That reset link is invalid or expired. Request a new one.", 400);
      const sessionToken = await createSession(updated.id);
      await revokeUserSessions(updated.id, sessionToken);
      return Response.json({ user: publicUser(updated), token: sessionToken }, { headers: { "Cache-Control": "no-store" } });
    }

    return jsonError("That account action is not supported.");
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") return jsonError("An account with that email already exists.", 409);
    console.error("Authentication request failed:", error);
    return jsonError("We could not complete that request. Please try again.", 500);
  }
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return jsonError("Sign in to update your profile.", 401);
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return jsonError("Please send a valid request.");
  }
  const action = typeof body.action === "string" ? body.action : "profile";

  try {
    if (action === "profile") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
      if (name.length < 2 || name.length > 140) return jsonError("Please enter your full name.");
      if (studentId.length > 48) return jsonError("Student ID must be 48 characters or fewer.");
      const [updated] = await db.update(users).set({ name, studentId: studentId || null, updatedAt: new Date() })
        .where(eq(users.id, currentUser.id))
        .returning({ id: users.id, name: users.name, email: users.email, studentId: users.studentId, role: users.role });
      const token = await createSession(updated.id);
      await revokeUserSessions(updated.id, token);
      return Response.json({ user: publicUser(updated), token }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "change-password") {
      const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
      const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
      if (newPassword.length < 10 || newPassword.length > 128) return jsonError("Your new password must be at least 10 characters.");
      const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, currentUser.id)).limit(1);
      if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) return jsonError("Your current password is incorrect.", 403);
      const [updated] = await db.update(users).set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
        .where(eq(users.id, currentUser.id))
        .returning({ id: users.id, name: users.name, email: users.email, studentId: users.studentId, role: users.role });
      const token = await createSession(updated.id);
      await revokeUserSessions(updated.id, token);
      return Response.json({ user: publicUser(updated), token }, { headers: { "Cache-Control": "no-store" } });
    }
    return jsonError("That profile action is not supported.");
  } catch (error) {
    console.error("Profile update failed:", error);
    return jsonError("We could not update your profile. Please try again.", 500);
  }
}
