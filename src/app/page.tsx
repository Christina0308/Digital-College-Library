import { LibraryApp } from "@/app/library-app";
import { ensureDemoData, getCatalog, getCategories } from "@/lib/library";
import { getCurrentUser } from "@/lib/security";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureDemoData();
  const [books, categories, user] = await Promise.all([getCatalog(), getCategories(), getCurrentUser()]);
  return <LibraryApp initialBooks={books} initialCategories={categories} initialUser={user} />;
}
