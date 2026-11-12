"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface UserProfile {
  id?: string;
  email: string;
  role: string;
  organizationId?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      let res = await fetch("/api/auth/me");
      if (res.status === 401) {
        // Attempt a token refresh once
        const refreshRes = await fetch("/api/auth/refresh", { method: "POST" });
        if (refreshRes.ok) {
          res = await fetch("/api/auth/me");
        }
      }
      if (!res.ok) return null;
      const json = await res.json();
      if (json?.success && json?.data?.user) {
        return json.data.user;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    const u = await fetchUser();
    setUser(u);
    setLoading(false);
  }, [fetchUser]);

  useEffect(() => {
    let isMounted = true;
    fetchUser().then((u) => {
      if (isMounted) {
        setUser(u);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout request error:", err);
    } finally {
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
