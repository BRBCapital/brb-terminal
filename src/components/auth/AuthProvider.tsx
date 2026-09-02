"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Role = "analyst" | "pm" | "admin";
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const body = await res.json();
      setUser(body.ok ? body.user : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ user, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useUser(): AuthCtx {
  return useContext(Ctx);
}

// Full role names for prose/labels.
export const ROLE_LABEL: Record<Role, string> = {
  analyst: "Analyst",
  pm: "Principal Fund Manager",
  admin: "Admin",
};

// Short forms for compact badges.
export const ROLE_BADGE: Record<Role, string> = {
  analyst: "Analyst",
  pm: "PFM",
  admin: "Admin",
};
