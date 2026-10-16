import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "@tanstack/react-router";
import { logLogout } from "@/lib/logs.functions";
import { clearOfflineSessionCache, dispatchOfflineAuthChanged } from "@/lib/offline/session";

const STORAGE_KEY = "jewelry_auth_state";

export type Role = "merchant" | "admin" | "price_manager";

export interface AuthState {
  token: string | null;
  role: Role | null;
  merchantId?: number;
}

export function loadAuthState(): AuthState {
  if (typeof window === "undefined") return { token: null, role: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, role: null };
    const parsed = JSON.parse(raw) as AuthState;
    if (!parsed || typeof parsed !== "object") return { token: null, role: null };
    return parsed;
  } catch {
    return { token: null, role: null };
  }
}

function saveAuthState(state: AuthState) {
  try {
    if (state.token) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

export function readToken(): string {
  return loadAuthState().token ?? "";
}

function merchantOwnerId(state: AuthState): number | undefined {
  return state.role === "merchant" && Number.isSafeInteger(state.merchantId) && (state.merchantId ?? 0) > 0
    ? state.merchantId
    : undefined;
}

export function loginAs(state: AuthState) {
  const previous = loadAuthState();
  saveAuthState(state);
  const previousMerchantId = merchantOwnerId(previous);
  const merchantId = merchantOwnerId(state);
  if (previousMerchantId !== merchantId) clearOfflineSessionCache(previousMerchantId);
  dispatchOfflineAuthChanged({ ...(previousMerchantId ? { previousMerchantId } : {}), ...(merchantId ? { merchantId } : {}), role: state.role });
}

export function logout() {
  const previous = loadAuthState();
  const token = previous.token ?? "";
  if (token) logLogout({ data: { token } }).catch(() => undefined);
  saveAuthState({ token: null, role: null });
  const previousMerchantId = merchantOwnerId(previous);
  clearOfflineSessionCache(previousMerchantId);
  dispatchOfflineAuthChanged({ ...(previousMerchantId ? { previousMerchantId } : {}), role: null });
}

export function routeForRole(role: Role | null): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "price_manager":
      return "/prices";
    case "merchant":
      return "/app";
    default:
      return "/";
  }
}

/** Redirects away when the stored session does not match the expected role. */
export function useRequireRole(expected: Role | Role[]) {
  const router = useRouter();
  const [state, setState] = useState<AuthState | null>(null);

  useEffect(() => {
    const current = loadAuthState();
    setState(current);
    const roles = Array.isArray(expected) ? expected : [expected];
    if (!current.token || !current.role || !roles.includes(current.role)) {
      router.navigate({ to: routeForRole(current.role ?? null), replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

// Legacy context kept for compatibility with components that prefer a provider.
const AuthContext = createContext<{
  authState: AuthState;
  logout: () => void;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ token: null, role: null });

  useEffect(() => {
    setAuthState(loadAuthState());
  }, []);

  const doLogout = useCallback(() => {
    logout();
    setAuthState({ token: null, role: null });
  }, []);

  return <AuthContext.Provider value={{ authState, logout: doLogout }}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
