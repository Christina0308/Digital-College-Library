# Digital College Library (MIT)

A responsive digital library built with Next.js App Router, TypeScript, PostgreSQL, and Drizzle ORM. Students can search the catalog, check live copy availability and precise shelf locations, reserve available copies for 24 hours, and manage their loans. Librarians manage books, copies, checkouts, returns, and holds; administrators manage accounts and roles.

## Quick start

Requirements: Node.js 20+, npm, and the Netlify CLI. Data is stored in Netlify Database (managed Postgres), which is provisioned automatically.

1. Link the project with `netlify link`.
2. Set a unique random `SESSION_SECRET` (at least 32 random bytes) and `APP_URL` for your deployment.
3. Install packages:

   ```bash
   npm install
   ```

4. Start the application:

   ```bash
   netlify dev
   ```

5. Open the home page. The first catalog or authentication request seeds the sample categories, books, copies, and demo accounts.

The application runs Drizzle queries through `src/db/index.ts`; the schema is in `src/db/schema.ts`. After editing the schema, run `npx drizzle-kit generate --name <change>`; migrations in `netlify/database/migrations/` are applied automatically on every deploy.

## Design system: "Atheneum"

A premium reading-room aesthetic — warm ivory and espresso neutrals, a champagne-gold accent, and editorial typography.

**Typography.** `Fraunces` (variable, optical sizing) for display type and `Inter` for UI copy, both self-hosted via `next/font` with automatic preloading and zero layout shift. Numerals are tabular wherever counts, dates, or barcodes align.

**Colour.** Espresso is the brand so the status hues stay unambiguous: **green = available**, **amber = on loan**, **blue = on hold**, **rose = error**. Gold is reserved for highlights and is never used for body text.

**Depth.** A four-step elevation scale (`--elev-1` … `--elev-4`) with layered low-opacity shadows, hairline inner highlights, frosted-glass header and dialogs, a fine grain texture on the hero, and gilded edge details.

### Light & dark

Every colour is a token defined once in `src/app/globals.css`; **no rule contains a hard-coded colour** (the only literal in the compiled output is `#0000`, the minifier's shorthand for `transparent`). `:root` holds the light values and `[data-theme="dark"]` re-points the same 92 token names, so the themes can never drift apart.

- **Toggle** — sun/moon control in the header (and in the mobile menu).
- **Follows your system** by default and keeps following it until you choose explicitly; your choice is then saved to `localStorage`.
- **No flash of the wrong theme** — a script in `<head>` applies the saved theme before first paint.
- **Accessible contrast** — all 35 key foreground/background pairs were measured and meet WCAG AA (≥ 4.5:1) in *both* themes, including status badges, role chips, the hero, and cover placeholders.
- Colour transitions start only after first paint, and all motion is disabled under `prefers-reduced-motion`.

## Sample collection

The seed catalog (`src/db/demo-catalog.ts`) contains **25 titles / 59 physical copies** across Computer science, Java, C++, Python, Data structures, Engineering mathematics, AutoCAD & design, Literature, Science, Business, and Psychology. Subject examples include:

| Subject | Example titles (authors) |
| --- | --- |
| Java | *Java: The Complete Reference* (Herbert Schildt & Danny Coward), *Head First Java* (Kathy Sierra, Bert Bates & Trisha Gee), *Core Java, Volume I* (Cay S. Horstmann) |
| C++ | *C++ Primer* (Stanley B. Lippman, Josée Lajoie & Barbara E. Moo), *C++ Templates* (Vandevoorde, Josuttis & Gregor), *Programming: Principles and Practice Using C++* (Bjarne Stroustrup) |
| Python | *Python Crash Course* (Eric Matthes), *Data Structures and Algorithms in Python* (Goodrich, Tamassia & Goldwasser), *Fluent Python* (Luciano Ramalho) |
| Data structures | *Introduction to Algorithms* (Cormen, Leiserson, Rivest & Stein) |
| Engineering mathematics | *Advanced Engineering Mathematics* (Kreyszig, Kreyszig & Norminton), *Engineering Mathematics* (Stroud & Booth), *Higher Engineering Mathematics* (B. S. Grewal) |
| AutoCAD & design | *AutoCAD and Its Applications: Basics* (Shumaker, Madsen & Madsen), *Technical Drawing with Engineering Graphics* (Giesecke et al.) |

Every title has individually barcoded copies with building, floor, section, shelf, and rack coordinates (for example `Founders Library · Floor 2 · Programming · Java · Shelf JAVA-01 · Rack 1`). Author, title, ISBN, and category are all searchable, so `Lippman` or `Schildt` finds the right book.

Seeding is **idempotent**: a row in `library_seed_marks` (`demo-catalog-v2-subjects`) records that the catalog has been installed. New subject titles are added to an existing library once, and afterwards the seeder never rewrites librarian edits or resurrects deleted books/copies.

## Sessions in embedded previews

The preview runs the app inside a cross-site iframe, where browsers discard `SameSite=Lax` cookies. That produced a confusing loop: the UI showed you signed in (from the login response) while the API saw no session and asked you to sign in again when reserving.

Sessions are now **stored server-side** in the `sessions` table and are resilient to blocked cookies:

1. **Opaque tokens** — sign-in creates a random 32-byte token; only its SHA-256 hash is stored, with an expiry and revocation timestamp. Validation is a database lookup, so it no longer depends on a signing secret or on an exact `users.updated_at` match (which previously invalidated sessions after unrelated account writes).
2. **Cookie policy** — in production the cookie is `HttpOnly; Secure; SameSite=None`, so it is sent from embedded/cross-site contexts.
3. **Bearer fallback** — session-issuing endpoints also return the token. The client keeps it in memory plus local/session storage and sends `Authorization: Bearer <token>`, so reservations work even when third-party cookies are blocked entirely. A stale anonymous response can no longer wipe a freshly issued token.
4. **Precise failures** — a rejected session returns a `reason` (`no-credential`, `unknown-session`, `expired`, `revoked`, `inactive-account`). The book dialog shows a persistent notice with a **Sign in again** action that completes the reservation you were attempting, and the header shows a **Session active / Session lost** indicator.

Sign-out revokes only the current session. Password changes and resets revoke the user's other sessions while keeping the new one. Deactivating an account or changing its role revokes that user's sessions immediately.

## Reserving a book

1. Sign in as a student (reserving from a logged-out state opens sign-in and then completes the reservation automatically).
2. Open a book and press **Reserve copy** on an available copy.
3. The dialog immediately shows the held copy, its exact shelf location, and the pickup deadline; **My shelf → Reservations** shows the countdown and a cancel action.

The reservation API returns the refreshed book in the same response, so the dialog updates without depending on a second request. Staff accounts see an explanatory note instead of a student-only action; librarians check copies out from the Staff desk.

## Demo sign-ins

When `SEED_DEMO_USERS` is unset or `true`, the starter seeds the following demonstrator accounts. Use the same credentials in the sign-in dialog’s demo shortcuts.

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@mit.edu` | `LibraryStudent!24` |
| Librarian | `librarian@mit.edu` | `LibraryStaff!24` |
| Administrator | `admin@mit.edu` | `LibraryAdmin!24` |

These are **demo-only credentials**. Before exposing a deployment publicly, sign in as the administrator, change the password, remove/deactivate demo users as appropriate, and set `SEED_DEMO_USERS=false`. Branding lives in `src/lib/branding.ts` and can be overridden with `NEXT_PUBLIC_LIBRARY_NAME`, `NEXT_PUBLIC_INSTITUTION_NAME`, `NEXT_PUBLIC_EMAIL_DOMAIN`, and `NEXT_PUBLIC_ID_PREFIX`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | Independent random HMAC key used to sign HTTP-only sessions. If omitted, the server falls back to the private database connection string; configure a dedicated value in every production environment. |
| `NEXT_PUBLIC_LIBRARY_NAME` | Library name shown in the UI (default `Digital College Library`). |
| `NEXT_PUBLIC_INSTITUTION_NAME` | Institution shown beside the library name (default `MIT`). |
| `NEXT_PUBLIC_EMAIL_DOMAIN` | Domain used for seeded demo accounts and email placeholders (default `mit.edu`). |
| `NEXT_PUBLIC_ID_PREFIX` | Prefix for generated barcodes and student IDs (default `MIT`). |
| `APP_URL` | Canonical public URL used to construct password-reset links. |
| `SEED_DEMO_USERS` | Set to `false` to skip creation of the three predictable demo accounts. Sample book/category data remains available; borrowed/held sample copies are only seeded when the demo student exists. |
| `RESEND_API_KEY` | Optional Resend API key for delivering production password-reset email. Keep server-side; never use a `NEXT_PUBLIC_` prefix. |
| `MAIL_FROM` | Verified sender for reset emails, e.g. `Digital College Library <library@mit.edu>`. |
| `CRON_SECRET` | Bearer secret for the scheduled 24-hour reservation-expiry job. Use an independent random value. |

Password reset requests are stored as SHA-256 token hashes and expire after one hour. In development, the reset URL is returned to the requesting screen for demonstration. In production, configure `RESEND_API_KEY` and `MAIL_FROM`; responses do not reveal whether an email exists. Passwords are salted and hashed with Node.js `scrypt`, and sessions use signed, HTTP-only, SameSite cookies. Account changes revoke existing sessions through the user-version timestamp.

## Reservation expiry

A reservation holds one specific copy for 24 hours from creation. Row locks and a partial unique PostgreSQL index prevent simultaneous reservations for the same copy. Expiration is swept during catalog, shelf, and staff requests, so an open application also refreshes holds at least every 30 seconds. `vercel.json` additionally schedules `GET /api/cron/expire-reservations` every minute. Configure `CRON_SECRET`; the job requires `Authorization: Bearer <CRON_SECRET>`. On other hosting providers, configure the same authenticated GET endpoint in that provider’s scheduler.

## Database structure

- `users`: unique email, student/staff/admin role, active flag, profile fields, scrypt hash, and one-time reset-token hash/expiry.
- `categories`: subject/department/genre names, slugs, and descriptions.
- `books`: shared bibliographic information (title, author, ISBN, description, cover, publisher/year, category).
- `book_copies`: individual barcoded inventory records with status and building/floor/section/shelf/rack coordinates.
- `loans`: borrower, copy, checkout/due/return timestamps. A partial unique index allows at most one open loan per copy.
- `reservations`: student, individual copy, active/collected/cancelled/expired status, creation and expiry timestamps. A partial unique index allows at most one active reservation per copy.

The public availability totals are derived from individual copy statuses; they are not denormalized counters. Checkout/return/reserve/cancel operations update copy status in a database transaction. Expired holds become `expired` and return the copy to `available`.

## Main API routes

All write routes validate inputs and re-check the signed-in user’s role server-side. Authentication cookies are HTTP-only; administrative mutations are not exposed to student accounts.

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/auth` | `GET`, `POST`, `PATCH` | Current session; register/login/logout/forgot/reset; profile and password updates. |
| `/api/categories` | `GET` | Browse collection categories. |
| `/api/books` | `GET` | Search title, author, ISBN, category, and availability (`q`, `category`, `availability`). |
| `/api/books/[id]` | `GET` | Book details and exact individual-copy locations; own hold expiry is visible to the student who reserved it. |
| `/api/reservations` | `GET`, `POST`, `DELETE` | View a student shelf, reserve a copy for 24 hours, or cancel an active hold. |
| `/api/staff` | `GET`, `POST` | Librarian/admin dashboard; create/edit/remove books, add/edit copies, check out and return books. `POST` uses an `action` field. |
| `/api/admin/users` | `GET`, `POST`, `PATCH` | Admin-only account directory, account creation, roles, profiles, and activation. |
| `/api/cron/expire-reservations` | `GET` | Authenticated scheduled expiry sweep (`CRON_SECRET`). |
| `/api/health` | `GET` | Database health check. |

## Permissions at a glance

- **Students:** register, sign in, edit their own name/student ID/password, browse/filter books, reserve available copies, cancel their own active holds, and view their own loans.
- **Librarians:** all circulation tools plus book/copy inventory management, precise location/status updates, checkouts, returns, and hold cancellation.
- **Administrators:** librarian permissions plus account creation, profile/role management, activation/deactivation, and role assignment. At least one active administrator is always required.
