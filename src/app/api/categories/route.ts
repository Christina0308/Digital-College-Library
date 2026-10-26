import { db } from "@/db";
import { categories } from "@/db/schema";
import { ensureDemoData } from "@/lib/library";

export async function GET() {
  try {
    await ensureDemoData();
    const data = await db.select({ id: categories.id, name: categories.name, slug: categories.slug, description: categories.description })
      .from(categories).orderBy(categories.name);
    return Response.json({ categories: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Category query failed:", error);
    return Response.json({ error: "Categories are unavailable right now." }, { status: 500 });
  }
}
