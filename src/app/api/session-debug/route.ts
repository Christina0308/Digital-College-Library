import { cookies, headers } from "next/headers";
import { resolveSession } from "@/lib/security";

/** Reports exactly which credential reached the server. Never returns secrets. */
export async function GET() {
  const headerList = await headers();
  const cookieStore = await cookies();
  const authorization = headerList.get("authorization") ?? "";
  const session = await resolveSession();

  return Response.json({
    cookieReceived: Boolean(cookieStore.get("college_library_session")?.value),
    bearerReceived: authorization.toLowerCase().startsWith("bearer "),
    signedInAs: session.user ? { name: session.user.name, role: session.user.role } : null,
    reason: session.reason ?? null,
    secureContext: process.env.NODE_ENV === "production",
    buildId: process.env.BUILD_STAMP ?? "dev",
  }, { headers: { "Cache-Control": "no-store" } });
}
