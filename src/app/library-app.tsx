"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, BookmarkCheck, BookmarkPlus, CheckCircle2, ChevronDown, CircleAlert, Clock3, Filter, Library, LoaderCircle, LogIn, LogOut, Menu, Search, ShieldCheck, Sparkles, UserRound, UsersRound, X } from "lucide-react";
import { AuthDialog } from "@/app/components/auth-dialog";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { BookDetailDialog } from "@/app/components/book-detail-dialog";
import { StudentShelf } from "@/app/components/student-shelf";
import type { StudentShelfData } from "@/app/components/student-shelf";
import { StaffWorkspace } from "@/app/components/staff-workspace";
import type { StaffWorkspaceData } from "@/app/components/staff-workspace";
import { AdminWorkspace } from "@/app/components/admin-workspace";
import { BookCover, EmptyState } from "@/app/components/ui";
import { ApiError, apiFetch, apiPost, clearSessionToken, getSessionToken } from "@/lib/client-api";
import type { BookSummary, LibraryCategory, ReservationOutcome, SessionUser, UserRole } from "@/lib/types";
import { fullLibraryName, institutionName, libraryName } from "@/lib/branding";

type View = "discover" | "shelf" | "staff" | "admin";
type AuthMode = "login" | "register" | "forgot" | "reset";
type Toast = { id: number; message: string; kind: "success" | "error" | "info" };
type AdminAccount = { id: number; name: string; email: string; studentId: string | null; role: UserRole; active: boolean; createdAt: string };



export function LibraryApp({
  initialBooks,
  initialCategories,
  initialUser,
}: {
  initialBooks: BookSummary[];
  initialCategories: LibraryCategory[];
  initialUser: SessionUser | null;
}) {
  const [books, setBooks] = useState(initialBooks);
  const [categories] = useState(initialCategories);
  const [user, setUser] = useState(initialUser);
  const [activeView, setActiveView] = useState<View>("discover");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [resetToken, setResetToken] = useState("");
  const [pendingView, setPendingView] = useState<View | null>(null);
  const [pendingReservation, setPendingReservation] = useState<number | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookSummary | null>(null);
  const [shelf, setShelf] = useState<StudentShelfData | null>(null);
  const [shelfLoading, setShelfLoading] = useState(false);
  const [staffData, setStaffData] = useState<StaffWorkspaceData | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sessionVerified, setSessionVerified] = useState<boolean | null>(null);

  const notify = useCallback((message: string, kind: Toast["kind"] = "success") => {
    setToast({ id: Date.now() + Math.random(), message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4300);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!getSessionToken()) return;
    let live = true;
    apiFetch<{ user: SessionUser | null }>("/api/auth")
      .then((payload) => {
        if (!live) return;
        if (payload.user) { setUser(payload.user); setSessionVerified(true); }
        else { clearSessionToken(); setSessionVerified(false); }
      })
      .catch(() => { if (live) clearSessionToken(); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset");
    if (!token) return;
    setResetToken(token);
    setAuthMode("reset");
    setAuthOpen(true);
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }, []);

  const refreshCatalog = useCallback(async (showLoading = false) => {
    if (showLoading) setCatalogLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (availabilityFilter !== "all") params.set("availability", availabilityFilter);
    try {
      const payload = await apiFetch<{ books: BookSummary[] }>(`/api/books${params.size ? `?${params.toString()}` : ""}`);
      setBooks(payload.books);
      setLastUpdated(new Date());
    } catch (error) {
      if (showLoading) notify(error instanceof Error ? error.message : "The catalog could not be refreshed.", "error");
    } finally {
      if (showLoading) setCatalogLoading(false);
    }
  }, [availabilityFilter, categoryFilter, notify, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshCatalog(true); }, 260);
    return () => window.clearTimeout(timer);
  }, [refreshCatalog]);

  useEffect(() => {
    if (activeView !== "discover") return;
    const interval = window.setInterval(() => { void refreshCatalog(false); }, 30_000);
    return () => window.clearInterval(interval);
  }, [activeView, refreshCatalog]);

  const refreshShelf = useCallback(async (actingUserId?: number) => {
    const shelfUserId = actingUserId ?? user?.id;
    if (!shelfUserId) return;
    setShelfLoading(true);
    try {
      setShelf(await apiFetch<StudentShelfData>("/api/reservations"));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Your shelf could not be loaded.", "error");
    } finally {
      setShelfLoading(false);
    }
  }, [notify, user?.id]);

  const refreshStaff = useCallback(async () => {
    if (!user || (user.role !== "librarian" && user.role !== "admin")) return;
    setStaffLoading(true);
    try {
      setStaffData(await apiFetch<StaffWorkspaceData>("/api/staff"));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Staff tools could not be loaded.", "error");
    } finally {
      setStaffLoading(false);
    }
  }, [notify, user?.id, user?.role]);

  const refreshAdmin = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    setAdminLoading(true);
    try {
      const payload = await apiFetch<{ users: AdminAccount[] }>("/api/admin/users");
      setAdminAccounts(payload.users);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Account management could not be loaded.", "error");
    } finally {
      setAdminLoading(false);
    }
  }, [notify, user?.id, user?.role]);

  useEffect(() => {
    if (!user || activeView !== "shelf") return;
    void refreshShelf();
    const interval = window.setInterval(() => { void refreshShelf(); }, 30_000);
    return () => window.clearInterval(interval);
  }, [activeView, refreshShelf, user?.id]);

  useEffect(() => {
    if (!user || activeView !== "staff" || (user.role !== "librarian" && user.role !== "admin")) return;
    void refreshStaff();
    const interval = window.setInterval(() => { void refreshStaff(); }, 30_000);
    return () => window.clearInterval(interval);
  }, [activeView, refreshStaff, user?.id]);

  useEffect(() => {
    if (!user || activeView !== "admin" || user.role !== "admin") return;
    void refreshAdmin();
  }, [activeView, refreshAdmin, user?.id]);

  const availableCount = useMemo(() => books.reduce((sum, book) => sum + book.availableCopies, 0), [books]);
  const selectedCategoryName = categoryFilter === "all" ? "Every subject" : categories.find((category) => category.slug === categoryFilter)?.name ?? "Every subject";

  function navigate(view: View) {
    setMobileMenuOpen(false);
    if (view !== "discover" && !user) {
      setPendingView(view);
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }
    if (view === "staff" && user?.role !== "librarian" && user?.role !== "admin") {
      notify("Librarian access is required for the staff workspace.", "error");
      return;
    }
    if (view === "admin" && user?.role !== "admin") {
      notify("Administrator access is required.", "error");
      return;
    }
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleAuthSuccess(nextUser: SessionUser) {
    setUser(nextUser);
    setAuthOpen(false);
    setShelf(null);
    setStaffData(null);
    setAdminAccounts([]);
    setActiveView(pendingView ?? "discover");
    setPendingView(null);
    setResetToken("");
    setSessionVerified(true);
    const copyToReserve = pendingReservation;
    setPendingReservation(null);
    if (copyToReserve !== null && nextUser.role === "student") {
      void reserveCopy(copyToReserve, nextUser).then((outcome) => {
        if (!outcome.ok) notify(outcome.message, outcome.needsSignIn ? "info" : "error");
      });
      return;
    }
    notify(`Welcome${nextUser.name ? `, ${nextUser.name.split(" ")[0]}` : ""} — you’re signed in.`, "success");
  }

  async function logout() {
    try {
      await apiPost("/api/auth", { action: "logout" });
      clearSessionToken();
      setUser(null);
      setSessionVerified(null);
      setShelf(null);
      setStaffData(null);
      setAdminAccounts([]);
      setActiveView("discover");
      notify("You’ve signed out safely.", "info");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not sign out.", "error");
    }
  }

  async function reserveCopy(copyId: number, actingUser: SessionUser | null = user): Promise<ReservationOutcome> {
    if (!actingUser) {
      setPendingReservation(copyId);
      return { ok: false, message: "Sign in with your student account to hold this copy for 24 hours.", needsSignIn: true };
    }
    if (actingUser.role !== "student") {
      const message = "Reservations are made from student accounts. Staff can check a copy out at the library desk.";
      notify(message, "error");
      return { ok: false, message };
    }
    try {
      const result = await apiPost<{ message: string; book: BookSummary | null }>("/api/reservations", { copyId });
      setSessionVerified(true);
      notify(result.message, "success");
      void refreshCatalog(false);
      void refreshShelf(actingUser.id);
      return { ok: true, book: result.book ?? null };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSessionToken();
        setUser(null);
        setSessionVerified(false);
        setPendingReservation(copyId);
        return { ok: false, message: error.message, needsSignIn: true };
      }
      const message = error instanceof Error ? error.message : "Could not reserve this copy.";
      notify(message, "error");
      void refreshCatalog(false);
      return { ok: false, message };
    }
  }

  function openAuth(mode: AuthMode = "login") {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  const desktopNav = (
    <nav className="primary-navigation" aria-label="Main navigation">
      <button className={activeView === "discover" ? "nav-item active" : "nav-item"} onClick={() => navigate("discover")}>Discover</button>
      <button className={activeView === "shelf" ? "nav-item active" : "nav-item"} onClick={() => navigate("shelf")}>My shelf</button>
      {(user?.role === "librarian" || user?.role === "admin") ? <button className={activeView === "staff" ? "nav-item active" : "nav-item"} onClick={() => navigate("staff")}>Staff desk</button> : null}
      {user?.role === "admin" ? <button className={activeView === "admin" ? "nav-item active" : "nav-item"} onClick={() => navigate("admin")}>Admin</button> : null}
    </nav>
  );

  return (
    <div className="library-site">
      <header className="site-header">
        <a className="brand-lockup" href="/" aria-label={`${fullLibraryName} home`}>
          <span className="brand-mark"><BookOpen size={22} strokeWidth={1.8} /></span>
          <span className="brand-name"><strong>{libraryName}</strong><small>{institutionName.toUpperCase()}</small></span>
        </a>
        {desktopNav}
        <div className="header-actions">
          <ThemeToggle />
          <div className="library-open-indicator"><span className="status-live-dot" /><span><strong>Library open</strong><small>Today until 8 pm</small></span></div>
          {user ? <button className="header-member" onClick={() => navigate("shelf")} aria-label="Open my shelf"><span className="header-avatar">{user.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span className="header-member-name">{user.name.split(" ")[0]}<small>{roleName(user.role)}</small></span><ChevronDown size={14} /></button> : <button className="button button-outline header-signin" onClick={() => openAuth("login")}><LogIn size={15} /> Sign in</button>}
          {user && sessionVerified !== null ? (
            <span className={`session-pill ${sessionVerified ? "session-ok" : "session-lost"}`} title={sessionVerified ? "The server has verified your sign-in — reservations will work." : "The server cannot see your sign-in. Open a book and use ‘Sign in again’."}>
              {sessionVerified ? <ShieldCheck size={13} /> : <CircleAlert size={13} />}
              <span>{sessionVerified ? "Session active" : "Session lost"}</span>
            </span>
          ) : null}
          {user ? <button className="icon-action header-logout" title="Sign out" aria-label="Sign out" onClick={() => void logout()}><LogOut size={16} /></button> : <button className="button button-primary header-join" onClick={() => openAuth("register")}>Join the library <ArrowRight size={15} /></button>}
          <button className="mobile-menu-toggle" aria-expanded={mobileMenuOpen} aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMobileMenuOpen((open) => !open)}>{mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
        {mobileMenuOpen ? <div className="mobile-navigation">{desktopNav}<ThemeToggle /><div className="mobile-navigation-footer">{user ? <button className="button button-outline" onClick={() => void logout()}><LogOut size={15} /> Sign out</button> : <><button className="button button-outline" onClick={() => openAuth("login")}><LogIn size={15} /> Sign in</button><button className="button button-primary" onClick={() => openAuth("register")}>Create account <ArrowRight size={15} /></button></>}</div></div> : null}
      </header>

      {activeView === "discover" ? (
        <main>
          <section className="hero-wrap">
            <div className="hero-copy">
              <p className="hero-eyebrow"><span className="hero-eyebrow-dot" /><Sparkles size={14} /> A CAMPUS FULL OF STORIES</p>
              <h1>Find the book<br />that <em>moves you.</em></h1>
              <p className="hero-description">Your next big idea, favorite story, or late-night answer is closer than you think. Start with the shelves at the {libraryName}.</p>
              <div className="hero-cta-row"><button className="button button-primary hero-cta" onClick={() => document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" })}>Explore the collection <ArrowRight size={16} /></button><button className="hero-secondary-link" onClick={() => navigate("shelf")}>Go to my shelf <ArrowUpRight size={15} /></button></div>
              <div className="hero-facts"><div><strong>{initialBooks.length}+</strong><span>featured titles</span></div><span className="hero-fact-separator" /><div><strong>{initialBooks.reduce((sum, book) => sum + book.copiesOwned, 0)}+</strong><span>copies on campus</span></div><span className="hero-fact-separator" /><div><strong>24 hrs</strong><span>student book holds</span></div></div>
            </div>
            <div className="hero-art" aria-label="Featured books from the campus collection">
              <div className="hero-art-topline"><span><span className="hero-art-dot" /> THE CAMPUS COLLECTION</span><span>VOL. 01 / 2025</span></div>
              <div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" />
              <div className="hero-art-caption"><span>OPEN A NEW CHAPTER</span><strong>Ideas worth<br />getting lost in.</strong></div>
              <div className="hero-book-stack">
                {initialBooks.slice(0, 3).map((book, index) => <div key={book.id} className={`hero-book hero-book-${index + 1}`}><BookCover book={book} /></div>)}
                {initialBooks.length === 0 ? <div className="hero-abstract-book"><BookOpen size={43} /></div> : null}
              </div>
              <div className="hero-art-bottom"><span>READ. WONDER. REPEAT.</span><span className="hero-art-page">LIBRARY / 001 <ArrowUpRight size={13} /></span></div>
              <div className="hero-float-card"><span className="hero-float-icon"><BookmarkCheck size={16} /></span><span><strong>Hold it for 24 hours</strong><small>Pick up at your listed shelf</small></span><span className="float-check"><CheckCircle2 size={16} /></span></div>
            </div>
          </section>

          <section className="collection-section" id="collection">
            <div className="collection-heading-row"><div><p className="eyebrow">A WORLD OF KNOWLEDGE, ON YOUR CAMPUS</p><h2>Explore the collection<span>.</span></h2><p className="section-detail">Browse the shelves, see what’s here, and find exactly where to pick it up.</p></div><div className="collection-summary"><span className="collection-summary-icon"><Library size={19} /></span><span><strong>{availableCount} copies</strong><small>available to borrow now</small></span></div></div>
            <div className="catalog-tools">
              <label className="catalog-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title, author, or ISBN…" aria-label="Search book title, author, or ISBN" /><kbd>⌘ K</kbd></label>
              <label className="filter-select"><Filter size={16} /><span className="sr-only">Availability filter</span><select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)}><option value="all">All availability</option><option value="available">Available now</option><option value="unavailable">Checked out</option></select><ChevronDown size={14} /></label>
            </div>
            <div className="category-filter-row"><span className="category-filter-label">BROWSE BY SUBJECT</span><div className="category-pills"><button className={categoryFilter === "all" ? "category-pill selected" : "category-pill"} onClick={() => setCategoryFilter("all")}>Everything</button>{categories.map((category) => <button key={category.id} className={categoryFilter === category.slug ? "category-pill selected" : "category-pill"} onClick={() => setCategoryFilter(category.slug)}>{category.name}</button>)}</div><span className="current-subject"><span /> {selectedCategoryName}</span></div>
            <div className="results-toolbar"><p>{catalogLoading ? <><LoaderCircle size={14} className="spin" /> Finding books…</> : <>Showing <strong>{books.length}</strong> {books.length === 1 ? "title" : "titles"}{query || categoryFilter !== "all" || availabilityFilter !== "all" ? " matching your search" : " from the campus collection"}</>}</p><span className="live-update-note"><span className="status-live-dot" /> Availability updates live{lastUpdated ? ` · checked ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span></div>
            {books.length > 0 ? <div className="book-grid">{books.map((book) => <BookCard book={book} key={book.id} onOpen={() => setSelectedBook(book)} />)}</div> : <EmptyState title="No books found" detail="Try a different title, author, ISBN, subject, or availability filter." />}
          </section>
          <section className="module-guide" aria-labelledby="module-guide-title">
            <div className="module-guide-heading"><p className="eyebrow">A BETTER WAY TO USE YOUR LIBRARY</p><h2 id="module-guide-title">Five parts. One good place to start.</h2><p>From your first search to the moment a book is back on the shelf.</p></div>
            <div className="module-guide-grid">
              <article className="module-guide-card"><span className="module-number">01</span><span className="module-guide-icon"><UserRound size={17} /></span><h3>User registration & login</h3><p>Secure student accounts, password reset, and easy profile updates.</p></article>
              <article className="module-guide-card"><span className="module-number">02</span><span className="module-guide-icon"><Filter size={17} /></span><h3>Categories</h3><p>Explore subjects and departments, then narrow the collection to your interests.</p></article>
              <article className="module-guide-card"><span className="module-number">03</span><span className="module-guide-icon"><Search size={17} /></span><h3>Information display</h3><p>See live copy counts, availability, ISBN, and the exact shelf and rack.</p></article>
              <article className="module-guide-card"><span className="module-number">04</span><span className="module-guide-icon"><Library size={17} /></span><h3>Content management</h3><p>Librarians manage titles, copies, precise locations, checkouts, and returns.</p></article>
              <article className="module-guide-card"><span className="module-number">05</span><span className="module-guide-icon"><ShieldCheck size={17} /></span><h3>User & admin management</h3><p>Administrators assign roles and manage account profiles and access.</p></article>
            </div>
          </section>
          <section className="reserve-banner"><div className="reserve-banner-icon"><Clock3 size={22} /></div><div><p className="eyebrow">A LITTLE EXTRA TIME, JUST FOR YOU</p><h2>Found the one? Put it on hold.</h2><p>Reserve an available copy for 24 hours. We’ll show you the exact shelf, rack, and library to find it.</p></div><button className="button button-dark" onClick={() => { if (books[0]) setSelectedBook(books[0]); else document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" }); }}>See available books <ArrowRight size={16} /></button></section>
        </main>
      ) : null}

      {activeView === "shelf" && user ? <main className="workspace-main"><StudentShelf user={user} shelf={shelf} loading={shelfLoading} onRefresh={refreshShelf} onToast={notify} onUserUpdate={(updated) => setUser(updated)} /></main> : null}
      {activeView === "staff" && user && (user.role === "librarian" || user.role === "admin") ? <main className="workspace-main"><StaffWorkspace data={staffData} categories={categories} loading={staffLoading} onRefresh={refreshStaff} onToast={notify} /></main> : null}
      {activeView === "admin" && user?.role === "admin" ? <main className="workspace-main"><AdminWorkspace accounts={adminAccounts} loading={adminLoading} currentUser={user} onRefresh={refreshAdmin} onToast={notify} /></main> : null}

      <footer className="site-footer"><div className="footer-brand"><span className="brand-mark"><BookOpen size={19} /></span><span><strong>{libraryName}</strong><small>{institutionName.toUpperCase()}</small></span></div><p>Good questions deserve good books.</p><div className="footer-links"><span>Student access</span><span>·</span><a href="/diagnostics">Reservation diagnostics</a><span>·</span><span>Campus collections</span></div><small className="footer-copyright">© {new Date().getFullYear()} {fullLibraryName}. Learn something wonderful.</small></footer>

      {selectedBook ? <BookDetailDialog book={selectedBook} user={user} onClose={() => setSelectedBook(null)} onReserve={reserveCopy} onRequestSignIn={() => { setAuthMode("login"); setAuthOpen(true); }} /> : null}
      {authOpen ? <AuthDialog initialMode={authMode} initialToken={resetToken} onClose={() => setAuthOpen(false)} onSuccess={handleAuthSuccess} /> : null}
      {toast ? <div className={`toast toast-${toast.kind}`} role="status"><span className="toast-icon">{toast.kind === "error" ? <CircleAlert size={17} /> : toast.kind === "info" ? <LogOut size={16} /> : <CheckCircle2 size={17} />}</span><span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss message"><X size={15} /></button></div> : null}
    </div>
  );
}

function BookCard({ book, onOpen }: { book: BookSummary; onOpen: () => void }) {
  const available = book.availableCopies > 0;
  return (
    <article className="book-card">
      <button className="book-card-cover-button" onClick={onOpen} aria-label={`View ${book.title}`}>
        <BookCover book={book} className="book-card-cover" />
        <span className={`book-availability-ribbon ${available ? "ribbon-available" : "ribbon-unavailable"}`}><span />{available ? "Available now" : "On loan"}</span>
        <span className="book-card-open"><ArrowUpRight size={16} /></span>
      </button>
      <div className="book-card-body">
        <div className="book-card-kicker"><span className="category-label">{book.categoryName}</span>{book.publishedYear ? <span className="book-year">{book.publishedYear}</span> : null}</div>
        <button className="book-card-title" onClick={onOpen} title={book.title}>{book.title}</button>
        <p className="book-author" title={book.author}>{book.author}</p>
        <div className="book-card-divider" />
        <div className="book-card-footer"><span className="book-copy-count"><BookOpen size={14} /><strong>{book.availableCopies}</strong> of {book.copiesOwned} copies</span><button className={`book-details-button ${available ? "book-reserve-button" : ""}`} onClick={onOpen} title={available ? `Choose a copy of ${book.title} to reserve for 24 hours` : `See copies and shelf locations for ${book.title}`}>
          {available ? <><BookmarkPlus size={13} /> Reserve</> : <>View copies <ArrowRight size={14} /></>}
        </button></div>
      </div>
    </article>
  );
}

function roleName(role: UserRole) {
  if (role === "admin") return "Administrator";
  if (role === "librarian") return "Librarian";
  return "Student";
}
