import { ensureDemoData, getBookDetail } from "@/lib/library";
import { getCurrentUser } from "@/lib/security";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const bookId = Number(id);
  if (!Number.isInteger(bookId) || bookId < 1) return Response.json({ error: "That book could not be found." }, { status: 404 });
  try {
    const currentUser = await getCurrentUser();
    const book = await getBookDetail(bookId, currentUser?.id);
    if (!book) return Response.json({ error: "That book could not be found." }, { status: 404 });
    return Response.json({ book }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Book details query failed:", error);
    return Response.json({ error: "Book details are temporarily unavailable." }, { status: 500 });
  }
}
