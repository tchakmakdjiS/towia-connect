import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/towia";

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  is_active: boolean;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  role: null,
  profile: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;

    const loadUserData = async (userId: string | undefined) => {
      if (!userId) {
        if (active) {
          setRole(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      ]);
      if (!active) return;

      const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
      const priority: AppRole[] = ["admin", "company", "tow_operator", "customer"];
      setRole(priority.find((p) => roles.includes(p)) ?? null);
      setProfile((profileRes.data as Profile | null) ?? null);
      // Only release the loading gate once the role is known, otherwise
      // role-based redirects fire with a null role.
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) setLoading(false);
      void loadUserData(nextSession?.user.id);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
      void loadUserData(data.session?.user.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [tick]);

  const refresh = async () => {
    setTick((t) => t + 1);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setProfile(null);
    setSession(null);
    if (typeof window !== "undefined") window.location.assign("/");
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        profile,
        loading,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function displayName(
  profile: { first_name?: string | null; last_name?: string | null } | null,
  fallback?: string | null,
): string {
  const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return full || fallback || "Mon compte";
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}
