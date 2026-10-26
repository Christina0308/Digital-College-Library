"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, Play } from "lucide-react";
import { apiFetch, apiPost, clearSessionToken, getSessionToken } from "@/lib/client-api";
import type { BookSummary } from "@/lib/types";
import { emailDomain } from "@/lib/branding";

type Step = { label: string; ok: boolean; detail: string };
type Debug = { cookieReceived: boolean; bearerReceived: boolean; signedInAs: { name: string; role: string } | null; reason: string | null };

export function SessionCheck() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);

  function storageWorks() {
    try {
      window.localStorage.setItem("__lib_probe", "1");
      window.localStorage.removeItem("__lib_probe");
      return true;
    } catch {
      return false;
    }
  }

  async function run() {
    setRunning(true);
    setSteps([]);
    setVerdict(null);
    const found: Step[] = [];
    const push = (label: string, ok: boolean, detail: string) => {
      found.push({ label, ok, detail });
      setSteps([...found]);
    };

    try {
      push("Browser storage", storageWorks(), storageWorks()
        ? "localStorage is writable, so the session token can persist."
        : "localStorage is blocked — the app falls back to an in-memory token.");

      clearSessionToken();
      const before = await apiFetch<Debug>("/api/session-debug");
      push("Before sign-in", before.signedInAs === null, `Server sees: ${before.signedInAs ? before.signedInAs.name : "nobody"} (reason: ${before.reason ?? "none"}).`);

      const login = await apiPost<{ user: { name: string; role: string }; token?: string }>("/api/auth", {
        action: "login", email: `student@${emailDomain}`, password: "LibraryStudent!24",
      });
      push("Sign in", Boolean(login.user), login.user ? `Signed in as ${login.user.name} (${login.user.role}).` : "Sign-in failed.");
      push("Token issued", Boolean(login.token), login.token ? "Server returned a session token and the client stored it." : "No token returned — only the cookie can authenticate.");
      push("Token stored in browser", Boolean(getSessionToken()), getSessionToken() ? "Token is available for the Authorization header." : "Token missing — requests will rely on cookies.");

      const after = await apiFetch<Debug>("/api/session-debug");
      push("Credential reaching server", Boolean(after.signedInAs),
        `cookie: ${after.cookieReceived ? "sent" : "blocked"} · bearer: ${after.bearerReceived ? "sent" : "absent"} · server sees: ${after.signedInAs ? after.signedInAs.name : "nobody"}${after.reason ? ` (${after.reason})` : ""}.`);

      const catalog = await apiFetch<{ books: BookSummary[] }>("/api/books?availability=available");
      const target = catalog.books.find((book) => book.availableCopies > 0);
      if (!target) throw new Error("No available books to test with.");
      const detail = await apiFetch<{ book: BookSummary }>(`/api/books/${target.id}`);
      const copy = detail.book.copies.find((item) => item.status === "available");
      if (!copy) throw new Error("No available copy to test with.");
      push("Found a copy", true, `${detail.book.title} · ${copy.barcode}`);

      const reservation = await apiPost<{ message: string; reservation?: { id: number } }>("/api/reservations", { copyId: copy.id });
      push("Reserve", true, reservation.message);

      if (reservation.reservation?.id) {
        await apiFetch("/api/reservations", { method: "DELETE", body: JSON.stringify({ reservationId: reservation.reservation.id }) });
        push("Cleanup", true, "Test reservation cancelled, so the demo data is unchanged.");
      }

      setVerdict({ ok: true, text: "Reservations work in this browser. If the main page still asks you to sign in, you are running a cached older version — hard-refresh the page (Ctrl/Cmd + Shift + R)." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      push("Failed", false, message);
      setVerdict({ ok: false, text: `Stopped at the step above: ${message}` });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="diagnostic-card">
      <button className="button button-primary" onClick={() => void run()} disabled={running}>
        {running ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
        {running ? "Running checks…" : "Run the reservation test"}
      </button>

      {steps.length > 0 ? (
        <ol className="diagnostic-steps">
          {steps.map((step, index) => (
            <li key={`${step.label}-${index}`} className={step.ok ? "step-ok" : "step-fail"}>
              {step.ok ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
              <div><strong>{step.label}</strong><span>{step.detail}</span></div>
            </li>
          ))}
        </ol>
      ) : null}

      {verdict ? <p className={`diagnostic-verdict ${verdict.ok ? "verdict-ok" : "verdict-fail"}`}>{verdict.text}</p> : null}
    </section>
  );
}
