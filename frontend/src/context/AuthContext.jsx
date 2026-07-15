import { createContext, useContext, useState, useCallback } from "react";
import client from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("ksmart_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email, password) => {
    const { data } = await client.post("/auth/login", { email, password });
    localStorage.setItem("ksmart_token", data.token);
    localStorage.setItem("ksmart_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("ksmart_token");
    localStorage.removeItem("ksmart_user");
    setUser(null);
  }, []);

  const updateLanguage = useCallback(async (preferredLanguage) => {
    try {
      const { data } = await client.put("/profile", { preferredLanguage });
      const updated = { ...user, preferredLanguage: data.preferredLanguage };
      localStorage.setItem("ksmart_user", JSON.stringify(updated));
      setUser(updated);
      return updated;
    } catch (err) {
      console.error("Failed to update language preference:", err);
      throw err;
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateLanguage }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
