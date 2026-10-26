import { ensureDemoData, getCatalog } from "@/lib/library";

export async function GET(request: Request) {
  try {
    await ensureDemoData();
    const searchParams = new URL(request.url).searchParams;
    const books = await getCatalog({
      q: searchParams.get("q") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      availability: searchParams.get("availability") ?? undefined,
    });
    return Response.json({ books }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Catalog query failed:", error);
    return Response.json({ error: "The catalog is temporarily unavailable." }, { status: 500 });
  }
}
