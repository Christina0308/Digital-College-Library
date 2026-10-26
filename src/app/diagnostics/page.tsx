import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SessionCheck } from "@/app/diagnostics/session-check";
import { getCurrentUser } from "@/lib/security";

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  const user = await getCurrentUser();

  return (
    <main className="diagnostic-page">
      <Link className="text-button" href="/"><ArrowLeft size={15} /> Back to the library</Link>
      <p className="eyebrow">SUPPORT TOOL</p>
      <h1>Reservation diagnostics</h1>
      <p className="diagnostic-intro">
        This runs the real sign-in and reservation flow in your browser and shows exactly which step fails.
        It uses the demo student account and cancels its own test reservation afterwards.
      </p>

      <div className="diagnostic-server-state">
        <span>Server-rendered view of your session</span>
        <strong>{user ? `${user.name} · ${user.role}` : "Not signed in (no cookie reached the server)"}</strong>
      </div>

      <SessionCheck />
    </main>
  );
}
