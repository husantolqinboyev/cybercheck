import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  User,
  Session,
  getCurrentSession,
  validateSession,
  login as authLogin,
  logout as authLogout,
  getFingerprint,
  saveSession,
  clearSession,
} from "@/lib/auth";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  login: (login: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // First check localStorage for quick UI
      const currentSession = getCurrentSession();
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
      }

      // Then validate with server (HTTP-only cookie)
      const result = await validateSession();
      if (result.valid && result.user) {
        const newSession: Session = {
          token: "",
          user: result.user,
          expires_at: result.expires_at || "",
        };
        setSession(newSession);
        setUser(result.user);
        saveSession(newSession);
      } else if (!result.valid) {
        setSession(null);
        setUser(null);
        clearSession();
      }
      
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (loginInput: string, password: string) => {
    try {
      const fingerprint = await getFingerprint();
      const result = await authLogin(loginInput, password, fingerprint);
      
      if (result.success && result.session) {
        setSession(result.session);
        setUser(result.session.user);
        return { success: true };
      }
      
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: "Tizim xatosi" };
    }
  };

  const logout = async () => {
    await authLogout();
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
