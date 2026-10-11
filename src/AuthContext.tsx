// ============================================================
// AuthContext — Global provider for authentication & navigation state
// ============================================================

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  api,
  mockApi,
  getToken,
  setToken,
  clearToken,
  getTokenUserId,
  setTabUserId,
  setCurrentMockUser,
  isNetworkFailure,
  setOnUnauthorized,
} from "./api";
import type { User } from "./types";

export type ActiveTab = "events" | "my-registrations" | "analytics";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  backendMode: "live" | "mock";
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  authNotice: string | null;
  clearAuthNotice: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role: "user" | "admin") => Promise<void>;
  logout: () => void;
  eventsApi: typeof api;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function saveStoredUser(user: User) {
  const serialized = JSON.stringify(user);
  sessionStorage.setItem("user", serialized);
  localStorage.setItem("user", serialized);
}

function getStoredUser(): string | null {
  return sessionStorage.getItem("user") || localStorage.getItem("user");
}

function clearStoredUser() {
  sessionStorage.removeItem("user");
  localStorage.removeItem("user");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendMode, setBackendMode] = useState<"live" | "mock">("live");
  const [activeTab, setActiveTab] = useState<ActiveTab>("events");
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // Register a global listener for 401 Unauthorized on protected endpoints
  useEffect(() => {
    setOnUnauthorized(() => {
      clearToken();
      clearStoredUser();
      setUser(null);
      setActiveTab("events");
      setAuthNotice("Your session has expired or is invalid. Please sign in again.");
    });
    return () => setOnUnauthorized(null);
  }, []);

  // Keep per-tab user ID and token strictly synchronized
  useEffect(() => {
    setTabUserId(user ? user.id : null);
    if (!user) return;

    if (backendMode === "mock") {
      api
        .getEvents()
        .then(() => {
          setBackendMode("live");
        })
        .catch(() => {});
      return;
    }

    const currentTok = getToken();
    const tokenOwnerId = getTokenUserId(currentTok);
    if (currentTok && tokenOwnerId && tokenOwnerId !== user.id) {
      api
        .getMe(user.id)
        .then((res) => {
          if (res.token) {
            setToken(res.token, res.user.id);
          }
          saveStoredUser(res.user);
          setUser(res.user);
        })
        .catch(() => {});
    } else if (currentTok && tokenOwnerId === user.id) {
      setToken(currentTok, user.id);
      saveStoredUser(user);
    }
  }, [user, backendMode]);

  // On initial mount, restore and verify the persisted session for this tab
  useEffect(() => {
    const storedUser = getStoredUser();
    let parsedStoredUser: User | null = null;
    if (storedUser) {
      try {
        parsedStoredUser = JSON.parse(storedUser) as User;
        if (parsedStoredUser?.id) {
          setTabUserId(parsedStoredUser.id);
        }
      } catch {
        // Ignore parse error
      }
    }

    const token = getToken();

    if (!token || !storedUser) {
      clearToken();
      clearStoredUser();
      setLoading(false);
      return;
    }

    // If token is a mock token, check if live backend is reachable first.
    if (token.startsWith("mock-token-")) {
      api
        .getEvents()
        .then(() => {
          clearToken();
          clearStoredUser();
          setBackendMode("live");
          setLoading(false);
        })
        .catch((err) => {
          if (isNetworkFailure(err)) {
            try {
              const parsed: User = JSON.parse(storedUser);
              setCurrentMockUser(parsed);
              setUser(parsed);
              setBackendMode("mock");
            } catch {
              clearToken();
              clearStoredUser();
            }
          }
          setLoading(false);
        });
      return;
    }

    // Verify JWT token against the live backend (requesting the tab's stored user ID)
    api
      .getMe(parsedStoredUser?.id)
      .then((res) => {
        setToken(res.token || token, res.user.id);
        saveStoredUser(res.user);
        setUser(res.user);
        setBackendMode("live");
        setLoading(false);
      })
      .catch((err) => {
        if (isNetworkFailure(err)) {
          try {
            const parsed: User = JSON.parse(storedUser);
            setCurrentMockUser(parsed);
            setUser(parsed);
            setBackendMode("mock");
          } catch {
            clearToken();
            clearStoredUser();
          }
          setLoading(false);
        } else {
          clearToken();
          clearStoredUser();
          setUser(null);
          setAuthNotice("Your session has expired. Please sign in again.");
          setLoading(false);
        }
      });
  }, []);

  async function login(email: string, password: string) {
    setAuthNotice(null);
    try {
      const res = await api.login(email, password);
      setToken(res.token, res.user.id);
      saveStoredUser(res.user);
      setUser(res.user);
      setActiveTab("events");
      setBackendMode("live");
    } catch (err) {
      if (!isNetworkFailure(err)) {
        throw err;
      }
      const res = await mockApi.login(email, password);
      setToken(res.token, res.user.id);
      saveStoredUser(res.user);
      setCurrentMockUser(res.user);
      setUser(res.user);
      setActiveTab("events");
      setBackendMode("mock");
    }
  }

  async function signup(name: string, email: string, password: string, role: "user" | "admin") {
    setAuthNotice(null);
    try {
      const res = await api.signup(name, email, password, role);
      setToken(res.token, res.user.id);
      saveStoredUser(res.user);
      setUser(res.user);
      setActiveTab("events");
      setBackendMode("live");
    } catch (err) {
      if (!isNetworkFailure(err)) {
        throw err;
      }
      const res = await mockApi.signup(name, email, password, role);
      setToken(res.token, res.user.id);
      saveStoredUser(res.user);
      setCurrentMockUser(res.user);
      setUser(res.user);
      setActiveTab("events");
      setBackendMode("mock");
    }
  }

  function logout() {
    clearToken();
    clearStoredUser();
    setUser(null);
    setActiveTab("events");
  }

  function clearAuthNotice() {
    setAuthNotice(null);
  }

  const value: AuthContextValue = {
    user,
    loading,
    backendMode,
    activeTab,
    setActiveTab,
    authNotice,
    clearAuthNotice,
    login,
    signup,
    logout,
    eventsApi: backendMode === "mock" ? mockApi : api,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
