"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, Library, LoaderCircle, LockKeyhole, Mail, UserRound, X } from "lucide-react";
import { apiPost } from "@/lib/client-api";
import type { SessionUser } from "@/lib/types";
import { emailDomain, idPrefix, institutionName, libraryName } from "@/lib/branding";

type AuthMode = "login" | "register" | "forgot" | "reset";
type AuthResponse = { user?: SessionUser; message?: string; resetToken?: string; resetUrl?: string };

const demoAccounts = [
  { label: "Student", email: `student@${emailDomain}`, password: "LibraryStudent!24" },
  { label: "Librarian", email: `librarian@${emailDomain}`, password: "LibraryStaff!24" },
  { label: "Admin", email: `admin@${emailDomain}`, password: "LibraryAdmin!24" },
];

export function AuthDialog({
  initialMode = "login",
  initialToken = "",
  onClose,
  onSuccess,
}: {
  initialMode?: AuthMode;
  initialToken?: string;
  onClose: () => void;
  onSuccess: (user: SessionUser) => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState(initialToken);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMode(initialMode);
    if (initialToken) setToken(initialToken);
  }, [initialMode, initialToken]);

  function changeMode(next: AuthMode) {
    setMode(next);
    setError("");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (mode === "register" && password !== confirmPassword) {
      setError("Those passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "forgot") {
        const result = await apiPost<AuthResponse>("/api/auth", { action: "forgot", email });
        setMessage(result.message ?? "If an active account matches that email, reset instructions are on their way.");
        if (result.resetToken) {
          setToken(result.resetToken);
          setMode("reset");
        }
        return;
      }
      if (mode === "reset") {
        const result = await apiPost<AuthResponse>("/api/auth", { action: "reset", token, password });
        if (result.user) onSuccess(result.user);
        return;
      }
      const result = await apiPost<AuthResponse>("/api/auth", mode === "login"
        ? { action: "login", email, password }
        : { action: "register", name, email, studentId, password });
      if (result.user) onSuccess(result.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We could not complete that request.");
    } finally {
      setBusy(false);
    }
  }

  const heading = mode === "login" ? "Welcome back" : mode === "register" ? "Join the library" : mode === "forgot" ? "Reset your password" : "Choose a new password";
  const subtitle = mode === "login" ? "Sign in to reserve books and keep track of your loans." : mode === "register" ? "Create your student account to make the shelves yours." : mode === "forgot" ? "We’ll send a one-time reset link to your college email." : "Your secure reset link is valid for one hour.";

  return (
    <div className="modal-backdrop auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-heading">
        <button className="dialog-close" onClick={onClose} aria-label="Close sign in"><X size={19} /></button>
        <div className="auth-mark"><Library size={21} strokeWidth={1.8} /></div>
        <p className="eyebrow">{`${libraryName} · ${institutionName}`.toUpperCase()}</p>
        <h2 id="auth-heading">{heading}</h2>
        <p className="auth-subtitle">{subtitle}</p>

        {message ? <div className="inline-success"><KeyRound size={16} /><span>{message}</span></div> : null}
        {error ? <div className="inline-error" role="alert">{error}</div> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <>
              <label className="field-label">Full name
                <span className="field-with-icon"><UserRound size={16} /><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" minLength={2} maxLength={140} required /></span>
              </label>
              <label className="field-label">Student ID <span className="optional-label">optional</span>
                <input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder={`e.g. ${idPrefix}-20418`} maxLength={48} />
              </label>
            </>
          ) : null}
          {mode !== "reset" ? (
            <label className="field-label">College email
              <span className="field-with-icon"><Mail size={16} /><input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={`you@${emailDomain}`} maxLength={320} required /></span>
            </label>
          ) : null}
          {mode === "reset" ? (
            <label className="field-label">One-time reset token
              <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste your reset token" minLength={20} required />
            </label>
          ) : null}
          {mode === "login" || mode === "register" || mode === "reset" ? (
            <label className="field-label">{mode === "reset" ? "New password" : "Password"}
              <span className="field-with-icon"><LockKeyhole size={16} /><input autoComplete={mode === "login" ? "current-password" : "new-password"} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "login" ? "Your password" : "At least 10 characters"} minLength={mode === "login" ? 1 : 10} maxLength={128} required /><button className="field-icon-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
            </label>
          ) : null}
          {mode === "register" ? (
            <label className="field-label">Confirm password
              <span className="field-with-icon"><LockKeyhole size={16} /><input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" minLength={10} maxLength={128} required /></span>
            </label>
          ) : null}
          <button className="button button-primary auth-submit" disabled={busy} type="submit">
            {busy ? <LoaderCircle className="spin" size={17} /> : null}
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create student account" : mode === "forgot" ? "Send reset instructions" : "Set new password"}
          </button>
        </form>

        {mode === "login" ? (
          <div className="auth-links">
            <button onClick={() => changeMode("forgot")}>Forgot password?</button>
            <span>New to the library? <button onClick={() => changeMode("register")}>Create an account</button></span>
          </div>
        ) : (
          <button className="back-to-login" onClick={() => changeMode("login")}><ArrowLeft size={15} /> Back to sign in</button>
        )}

        {mode === "login" ? (
          <div className="demo-access">
            <div className="demo-access-heading"><span>TRY THE DEMO</span><span>Sample accounts</span></div>
            <div className="demo-account-list">
              {demoAccounts.map((account) => (
                <button type="button" key={account.label} onClick={() => { setEmail(account.email); setPassword(account.password); setError(""); }}>
                  <span>{account.label}</span><small>{account.email}</small>
                </button>
              ))}
            </div>
            <p>Choose an account to fill in the demo credentials, then sign in.</p>
          </div>
        ) : null}

        <p className="auth-privacy">Your account is protected with encrypted password hashing and a private sign-in session.</p>
      </section>
    </div>
  );
}
