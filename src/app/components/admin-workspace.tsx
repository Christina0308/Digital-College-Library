"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Check, CircleUserRound, LoaderCircle, Plus, Search, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { apiFetch, apiPost } from "@/lib/client-api";
import type { SessionUser, UserRole } from "@/lib/types";
import { EmptyState, formatDateTime, initials } from "@/app/components/ui";

type ManagedAccount = {
  id: number;
  name: string;
  email: string;
  studentId: string | null;
  role: UserRole;
  active: boolean;
  createdAt: string;
};
type Draft = { name: string; studentId: string; role: UserRole; active: boolean };
type ToastKind = "success" | "error" | "info";

export function AdminWorkspace({
  accounts,
  loading,
  currentUser,
  onRefresh,
  onToast,
}: {
  accounts: ManagedAccount[];
  loading: boolean;
  currentUser: SessionUser;
  onRefresh: () => Promise<void>;
  onToast: (message: string, kind?: ToastKind) => void;
}) {
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createStudentId, setCreateStudentId] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("librarian");
  const [createPassword, setCreatePassword] = useState("");

  useEffect(() => {
    setDrafts(Object.fromEntries(accounts.map((account) => [account.id, {
      name: account.name,
      studentId: account.studentId ?? "",
      role: account.role,
      active: account.active,
    }])));
  }, [accounts]);

  const filteredAccounts = useMemo(() => accounts.filter((account) => `${account.name} ${account.email} ${account.studentId ?? ""} ${account.role}`.toLowerCase().includes(query.toLowerCase())), [accounts, query]);
  const activeCount = accounts.filter((account) => account.active).length;
  const staffCount = accounts.filter((account) => account.role !== "student").length;

  function updateDraft(id: number, key: keyof Draft, value: string | boolean) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [key]: value } as Draft }));
  }

  async function saveAccount(account: ManagedAccount) {
    const draft = drafts[account.id];
    if (!draft) return;
    setSavingId(account.id);
    try {
      await apiPost("/api/admin/users", { userId: account.id, ...draft }, "PATCH");
      onToast(`${draft.name}’s account has been updated.`, "success");
      await onRefresh();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Could not update this account.", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    setCreateBusy(true);
    try {
      await apiPost("/api/admin/users", { name: createName, email: createEmail, studentId: createStudentId, role: createRole, password: createPassword });
      onToast("The account has been created.", "success");
      setCreateName(""); setCreateEmail(""); setCreateStudentId(""); setCreatePassword(""); setCreateRole("librarian"); setShowCreate(false);
      await onRefresh();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Could not create this account.");
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <section className="workspace admin-workspace">
      <div className="workspace-heading">
        <div><p className="eyebrow">ADMINISTRATION</p><h1>People & access<span>.</span></h1><p>Manage student, librarian, and administrator accounts.</p></div>
        <div className="admin-shield"><ShieldCheck size={20} /><span><strong>Admin access</strong><small>Changes are protected and audited</small></span></div>
      </div>
      <div className="staff-metrics admin-metrics"><Metric label="Total accounts" value={accounts.length} icon={<UsersRound size={17} />} /><Metric label="Active" value={activeCount} icon={<Check size={17} />} accent /><Metric label="Staff accounts" value={staffCount} icon={<ShieldCheck size={17} />} /><Metric label="Students" value={accounts.length - staffCount} icon={<CircleUserRound size={17} />} /></div>
      <div className="admin-toolbar"><div><h2>Account directory</h2><p>Roles and activation take effect immediately. Inactive accounts cannot sign in.</p></div><div className="admin-toolbar-actions"><label className="search-compact"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search accounts" /></label><button className="button button-primary" onClick={() => setShowCreate((value) => !value)}><UserPlus size={16} /> Add account</button></div></div>

      {showCreate ? <form className="create-account-card" onSubmit={createAccount}><div className="create-account-heading"><div><h3>Create an account</h3><p>Temporary passwords must be at least 10 characters.</p></div><button type="button" className="icon-action" aria-label="Close account form" onClick={() => setShowCreate(false)}>×</button></div>{createError ? <div className="inline-error" role="alert">{createError}</div> : null}<div className="create-account-fields"><label className="field-label">Full name<input value={createName} onChange={(event) => setCreateName(event.target.value)} minLength={2} maxLength={140} required /></label><label className="field-label">Email<input type="email" value={createEmail} onChange={(event) => setCreateEmail(event.target.value)} maxLength={320} required /></label><label className="field-label">Student ID <span className="optional-label">optional</span><input value={createStudentId} onChange={(event) => setCreateStudentId(event.target.value)} maxLength={48} /></label><label className="field-label">Role<select value={createRole} onChange={(event) => setCreateRole(event.target.value as UserRole)}><option value="student">Student</option><option value="librarian">Librarian</option><option value="admin">Administrator</option></select></label><label className="field-label">Temporary password<input type="password" value={createPassword} onChange={(event) => setCreatePassword(event.target.value)} minLength={10} maxLength={128} required /></label><button className="button button-primary create-submit" type="submit" disabled={createBusy}>{createBusy ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}Create account</button></div></form> : null}

      {loading && accounts.length === 0 ? <div className="loading-card"><LoaderCircle className="spin" size={19} /> Loading account directory…</div> : null}
      {!loading && filteredAccounts.length === 0 ? <EmptyState title={query ? "No matching accounts" : "No accounts yet"} detail={query ? "Try a different name, email, or role." : "Student registrations and staff accounts will appear here."} /> : null}
      <div className="account-list">
        {filteredAccounts.map((account) => {
          const draft = drafts[account.id] ?? { name: account.name, studentId: account.studentId ?? "", role: account.role, active: account.active };
          const isSelf = account.id === currentUser.id;
          return <article className={`account-card ${draft.active ? "" : "account-inactive"}`} key={account.id}>
            <div className="account-person"><span className={`account-avatar role-avatar-${account.role}`}>{initials(account.name)}</span><div><input className="account-name-input" value={draft.name} onChange={(event) => updateDraft(account.id, "name", event.target.value)} maxLength={140} aria-label={`Name for ${account.email}`} /><span className="account-email">{account.email}</span><small>{draft.studentId || "No student ID"} · Joined {formatDateTime(account.createdAt).split(",").slice(0, 2).join(",")}</small></div></div>
            <div className="account-role-control"><label>Role<select value={draft.role} disabled={isSelf} onChange={(event) => updateDraft(account.id, "role", event.target.value)}><option value="student">Student</option><option value="librarian">Librarian</option><option value="admin">Administrator</option></select></label><label className="account-student-control">Student ID<input value={draft.studentId} onChange={(event) => updateDraft(account.id, "studentId", event.target.value)} maxLength={48} placeholder="—" /></label></div>
            <div className="account-controls"><button className={`account-status-toggle ${draft.active ? "is-active" : ""}`} disabled={isSelf} onClick={() => updateDraft(account.id, "active", !draft.active)}><span className="toggle-track"><span /></span>{draft.active ? "Active" : "Inactive"}</button><button className="button button-small button-outline" disabled={savingId === account.id || isSelf && draft.role !== "admin"} onClick={() => void saveAccount(account)}>{savingId === account.id ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}Save changes</button></div>
          </article>;
        })}
      </div>
      <div className="admin-footnote"><ShieldCheck size={16} /><span>At least one active administrator must remain. Your own administrator role and account cannot be disabled from this screen.</span></div>
    </section>
  );
}

function Metric({ label, value, icon, accent = false }: { label: string; value: number; icon: React.ReactNode; accent?: boolean }) {
  return <div className={`staff-metric ${accent ? "metric-accent" : ""}`}><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong></div>;
}
