"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus, RefreshCw, Trash2, Check, AlertTriangle, Eye, EyeOff, KeyRound, Shuffle } from "lucide-react";
import { Panel } from "@/components/ui/Tile";
import { ROLE_LABEL, type Role } from "@/components/auth/AuthProvider";
import { useUser } from "@/components/auth/AuthProvider";
import { formatDate } from "@/lib/format";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
}

// Presented Admin-first so the primary use (creating the administrator) leads.
const ROLE_ORDER: Role[] = ["admin", "pm", "analyst"];

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const buf = new Uint32Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

export function UserManagement() {
  const { user: me } = useUser();
  const [users, setUsers] = useState<AdminUser[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    if (res.ok) {
      const b = await res.json();
      if (b.ok) setUsers(b.users);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <Panel title="Users & roles" subtitle="Create staff accounts and manage their access level">
      <div className="space-y-5">
        <CreateUserForm onCreated={load} />
        <div>
          <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-eyebrow text-ink/55">
            Existing users
          </p>
          {users === null ? (
            <div className="space-y-2">
              <div className="h-8 animate-pulse rounded bg-stone" />
              <div className="h-8 animate-pulse rounded bg-stone" />
            </div>
          ) : (
            <ul className="divide-y divide-stone rounded-lg border border-stone">
              {users
                .slice()
                .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
                .map((u) => (
                  <UserRow key={u.id} u={u} isSelf={u.id === me?.id} onChange={load} />
                ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("admin");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), role, password }),
      });
      const b = await res.json();
      if (b.ok) {
        setMsg({ kind: "ok", text: `Created ${b.user.email} as ${ROLE_LABEL[b.user.role as Role]}.` });
        setEmail("");
        setName("");
        setPassword("");
        setShow(false);
        onCreated();
      } else {
        setMsg({ kind: "err", text: b.error ?? "Could not create the user." });
      }
    } catch {
      setMsg({ kind: "err", text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-stone bg-sand/40 p-4">
      <p className="mb-3 flex items-center gap-2 font-sans text-[12px] font-semibold text-forest">
        <UserPlus className="h-4 w-4" /> Create a user
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">Email (username)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@brbcapital.co.uk"
            autoComplete="off"
            className="w-full rounded-lg border border-stone bg-surface px-3 py-2 font-sans text-[13px] outline-none focus:border-fresh"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">Full name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ada Admin"
            autoComplete="off"
            className="w-full rounded-lg border border-stone bg-surface px-3 py-2 font-sans text-[13px] outline-none focus:border-fresh"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-lg border border-stone bg-surface px-3 py-2 font-sans text-[13px] outline-none focus:border-fresh"
          >
            <option value="admin">Admin</option>
            <option value="pm">Principal Fund Manager (PFM)</option>
            <option value="analyst">Analyst</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-sans text-[10px] uppercase tracking-eyebrow text-ink/45">Password</span>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email && password && submit()}
              placeholder="min. 8 characters"
              autoComplete="new-password"
              className="w-full rounded-lg border border-stone bg-surface px-3 py-2 pr-16 font-mono text-[13px] outline-none focus:border-fresh"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
              <button type="button" onClick={() => { setPassword(generatePassword()); setShow(true); }} title="Generate a strong password" className="text-ink/40 hover:text-forest">
                <Shuffle className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setShow((v) => !v)} title={show ? "Hide" : "Show"} className="text-ink/40 hover:text-forest">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={submit}
          disabled={busy || !email.trim() || !password}
          className="inline-flex items-center gap-2 rounded-lg bg-fresh px-4 py-2 font-sans text-sm font-semibold text-forest hover:brightness-95 disabled:opacity-50"
        >
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {busy ? "Creating…" : "Create user"}
        </button>
        {msg && (
          <span
            className={`inline-flex items-center gap-1.5 font-sans text-[12px] ${
              msg.kind === "ok" ? "text-forest" : "text-loss"
            }`}
          >
            {msg.kind === "ok" ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {msg.text}
          </span>
        )}
      </div>
      <p className="mt-3 font-sans text-[10px] leading-relaxed text-ink/45">
        Passwords are scrypt-hashed — never stored in plain text and never shown again after creation.
        Note the password somewhere safe before leaving this page. To create your administrator account,
        keep the role on <strong className="font-semibold text-forest">Admin</strong>.
      </p>
    </div>
  );
}

const BADGE_STYLE: Record<Role, string> = {
  admin: "bg-forest text-[#F5F2EC]",
  pm: "bg-fresh/25 text-forest",
  analyst: "bg-stone text-ink/70",
};

function UserRow({ u, isSelf, onChange }: { u: AdminUser; isSelf: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function patch(payload: { role?: Role; password?: string }) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const b = await res.json();
      if (!b.ok) setErr(b.error ?? "Update failed.");
      else onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove ${u.email}? This cannot be undone.`)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      const b = await res.json();
      if (!b.ok) setErr(b.error ?? "Delete failed.");
      else onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-eyebrow ${BADGE_STYLE[u.role]}`}>
          {u.role === "pm" ? "PFM" : ROLE_LABEL[u.role]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-[13px] font-medium text-forest">
            {u.name} {isSelf && <span className="text-ink/40">· you</span>}
          </p>
          <p className="truncate font-sans text-[11px] text-ink/50">{u.email} · added {formatDate(u.created_at)}</p>
        </div>
        <select
          value={u.role}
          disabled={busy}
          onChange={(e) => patch({ role: e.target.value as Role })}
          title="Change role"
          className="rounded-md border border-stone bg-surface px-2 py-1 font-sans text-[11px] outline-none focus:border-fresh disabled:opacity-50"
        >
          <option value="admin">Admin</option>
          <option value="pm">PFM</option>
          <option value="analyst">Analyst</option>
        </select>
        <button
          onClick={() => setResetting((v) => !v)}
          title="Reset password"
          className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] text-forest hover:bg-sand"
        >
          <KeyRound className="h-3 w-3" />
        </button>
        <button
          onClick={remove}
          disabled={busy}
          title="Remove user"
          className="inline-flex items-center gap-1 rounded-md border border-stone px-2 py-1 font-sans text-[11px] text-loss hover:bg-loss/10 disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {resetting && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-stone bg-sand/40 p-2">
          <input
            type="text"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="new password (min. 8)"
            className="min-w-40 flex-1 rounded border border-stone bg-surface px-2 py-1 font-mono text-[12px] outline-none focus:border-fresh"
          />
          <button
            type="button"
            onClick={() => setNewPw(generatePassword())}
            className="rounded border border-stone px-2 py-1 font-sans text-[11px] text-forest hover:bg-sand"
          >
            Generate
          </button>
          <button
            onClick={async () => { await patch({ password: newPw }); setNewPw(""); setResetting(false); }}
            disabled={busy || newPw.length < 8}
            className="rounded bg-fresh px-2.5 py-1 font-sans text-[11px] font-semibold text-forest hover:brightness-95 disabled:opacity-50"
          >
            Set password
          </button>
        </div>
      )}

      {err && (
        <p className="mt-1.5 flex items-center gap-1 font-sans text-[11px] text-loss">
          <AlertTriangle className="h-3 w-3" /> {err}
        </p>
      )}
    </li>
  );
}
