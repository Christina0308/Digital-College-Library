import { drizzle } from "drizzle-orm/netlify-db";
import * as schema from "./schema";

// Both runtime drivers expose the same query API; narrow to one so overloaded
// builder methods (e.g. `returning`) resolve.
type Database = Extract<ReturnType<typeof drizzle<typeof schema>>, { batch: unknown }>;
const createDb = () => drizzle({ schema }) as Database;

const globalForDb = globalThis as typeof globalThis & {
  __libraryDb?: Database;
};

// Connect lazily: `next build` imports route modules while collecting page data,
// and the database connection is only available at runtime.
function getDb(): Database {
  globalForDb.__libraryDb ??= createDb();
  return globalForDb.__libraryDb;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = getDb();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
