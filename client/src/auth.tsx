import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "./api/client";
import type { Role, User } from "./types";

type Permission =
  | "users:manage" | "orders:transition" | "orders:cancel" | "products:write" | "inventory:adjust";

// Mirrors server/src/roles.ts. The server is the source of truth; this only hides buttons.
const UI_PERMISSIONS: Record<Permission, Role[]> = {
  "users:manage": ["admin"],
  "orders:transition": ["admin", "manager"],
  "orders:cancel": ["admin", "manager"],
  "products:write": ["admin", "manager"],
  "inventory:adjust": ["admin", "manager"],
};

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (p: Permission) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return setReady(true);
    api
      .get<{ user: User }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(logout)
      .finally(() => setReady(true));
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    tokenStore.set(r.token);
    setUser(r.user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, ready, login, logout, can: (p) => !!user && UI_PERMISSIONS[p].includes(user.role) }),
    [user, ready, login, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
