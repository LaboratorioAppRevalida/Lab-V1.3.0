import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  updateProfile as updateProfileService,
  type Profile,
} from "@/lib/profileService";
import { fetchSubscriptionFromApi, type Subscription } from "@/lib/subscriptionService";

export type UserRole = "admin" | "colaborador" | "student";

export interface User {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  avatarUrl?: string;
  role: UserRole;
  birthDate?: string;
  country?: string;
  cityUf?: string;
  phone?: string;
  createdAt: string;
}

export type RegisterData = Partial<User> & { senha?: string };

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isColaborador: boolean;
  isMentor: boolean;
  isLoading: boolean;
  isSuspended: boolean;
  login: (email: string, senha: string) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  reloadProfile: () => Promise<void>;
  reloadSubscription: () => Promise<void>;
  updateProfile: (changes: Partial<Pick<Profile, "name" | "display_name" | "country" | "city_uf" | "phone" | "birth_date" | "avatar_url">>) => Promise<boolean>;
  profileNetworkError: boolean;
  passwordRecoveryOpen: boolean;
  setPasswordRecoveryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  subscription: Subscription | null;
  isSubscribed: boolean;
  isSubscriptionLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function supabaseUserToUser(sbUser: SupabaseUser, p: Profile | null): User {
  const meta = (sbUser.user_metadata ?? {}) as Record<string, unknown>;
  if (p) {
    return {
      id: p.id,
      email: p.email,
      name: p.name,
      displayName: p.display_name ?? undefined,
      avatarUrl: p.avatar_url ?? undefined,
      role: p.is_admin ? "admin" : p.is_colaborador ? "colaborador" : "student",
      birthDate: p.birth_date ?? undefined,
      country: p.country ?? undefined,
      cityUf: p.city_uf ?? undefined,
      phone: p.phone ?? undefined,
      createdAt: p.created_at,
    };
  }
  const name =
    (meta.name as string | undefined) ||
    (sbUser.email ? sbUser.email.split("@")[0] : "Usuário");
  return {
    id: sbUser.id,
    email: sbUser.email ?? "",
    name,
    displayName: (meta.display_name as string | undefined) ?? undefined,
    role: sbUser.email === "admin@revalida.com" ? "admin" : "student",
    birthDate: (meta.birth_date as string | undefined) ?? undefined,
    country: (meta.country as string | undefined) ?? undefined,
    cityUf: (meta.city_uf as string | undefined) ?? undefined,
    phone: (meta.phone as string | undefined) ?? undefined,
    createdAt: sbUser.created_at,
  };
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha inválidos";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Este e-mail já está em uso";
  if (m.includes("password should be")) return "A senha deve ter ao menos 6 caracteres";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde alguns segundos.";
  return message;
}

async function loadProfileFromDb(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    if (import.meta.env.DEV) console.warn("[Auth] erro ao buscar profile:", error.message);
    return null;
  }
  return data as Profile | null;
}

async function createProfileInDb(sbUser: SupabaseUser): Promise<Profile | null> {
  const meta = (sbUser.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (meta.name as string | undefined) ||
    (sbUser.email ? sbUser.email.split("@")[0] : "Usuário");
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: sbUser.id,
      email: sbUser.email ?? "",
      name,
      display_name: (meta.display_name as string | undefined) ?? null,
      birth_date: (meta.birth_date as string | undefined) ?? null,
      country: (meta.country as string | undefined) ?? null,
      city_uf: (meta.city_uf as string | undefined) ?? null,
      phone: (meta.phone as string | undefined) ?? null,
      is_admin: sbUser.email === "admin@revalida.com",
    })
    .select()
    .single();
  if (error) {
    if (import.meta.env.DEV) console.warn("[Auth] erro ao criar profile:", error.message);
    return null;
  }
  return data as Profile | null;
}

async function updateStreakInDb(profile: Profile): Promise<Profile> {
  const today = new Date().toISOString().slice(0, 10);
  if (profile.last_login_date === today) return profile;
  let newStreak = 1;
  if (profile.last_login_date) {
    const prev = new Date(profile.last_login_date + "T00:00:00").getTime();
    const now = new Date(today + "T00:00:00").getTime();
    const delta = Math.round((now - prev) / 86_400_000);
    if (delta === 1) newStreak = (profile.streak_atual ?? 0) + 1;
  }
  const { data, error } = await supabase
    .from("profiles")
    .update({ streak_atual: newStreak, last_login_date: today, updated_at: new Date().toISOString() })
    .eq("id", profile.id)
    .select()
    .single();
  if (error) {
    if (import.meta.env.DEV) console.warn("[Auth] erro ao atualizar streak:", error.message);
    return profile;
  }
  return (data as Profile) ?? profile;
}

// ─── Suspension Overlay ──────────────────────────────────────────────────────

function SuspensionOverlay() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
        color: "#f8fafc",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🚫</div>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Conta Suspensa
      </h1>
      <p style={{ fontSize: "1rem", color: "#94a3b8", maxWidth: 420, lineHeight: 1.6 }}>
        Sua conta foi suspensa por violação dos termos de uso da plataforma Revalida.
        Caso acredite que isso é um erro, entre em contato com o suporte.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sbUser, setSbUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileNetworkError, setProfileNetworkError] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [passwordRecoveryOpen, setPasswordRecoveryOpen] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);

  // Holds the active Realtime channel so we can remove it on logout / user change
  const suspensionChannelRef  = useRef<RealtimeChannel | null>(null);
  const heartbeatIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const ACTIVE_SESSION_TOKEN  = "rvld_device_token";

  // ── Teardown helper ────────────────────────────────────────────────────────
  const removeSuspensionChannel = useCallback(() => {
    if (suspensionChannelRef.current) {
      supabase.removeChannel(suspensionChannelRef.current).catch(() => {});
      suspensionChannelRef.current = null;
    }
  }, []);

  // ── Core sign-out (also used by the suspension handler) ───────────────────
  const performSignOut = useCallback(async () => {
    removeSuspensionChannel();
    await supabase.auth.signOut();
    setSbUser(null);
    setProfile(null);
  }, [removeSuspensionChannel]);

  const loadProfile = useCallback(async (u: SupabaseUser): Promise<Profile | null> => {
    setProfileNetworkError(false);
    try {
      let p = await loadProfileFromDb(u.id);

      if (!p) {
        p = await createProfileInDb(u);
      }

      if (p) {
        // Guard: if the user is already suspended on load, block immediately
        if (p.is_suspended) {
          setIsSuspended(true);
          await performSignOut();
          return null;
        }

        p = await updateStreakInDb(p);
        setProfile(p);
        return p;
      }

      return null;
    } catch (e) {
      if (import.meta.env.DEV) console.warn("[Auth] erro inesperado em loadProfile:", e);
      setProfileNetworkError(true);
      return null;
    }
  }, [performSignOut]);

  // ── Realtime suspension watcher ───────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !sbUser) {
      removeSuspensionChannel();
      return;
    }

    // Tear down any existing channel from a previous session before creating a new one
    removeSuspensionChannel();

    const channel = supabase
      .channel(`profile-suspension:${sbUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${sbUser.id}`,
        },
        async (payload) => {
          const updated = payload.new as Partial<Profile>;
          if (updated.is_suspended === true) {
            if (import.meta.env.DEV) console.warn("[Auth] conta suspensa via Realtime — encerrando sessão");
            setIsSuspended(true);
            await performSignOut();
          }
        },
      )
      .subscribe();

    suspensionChannelRef.current = channel;

    return () => {
      removeSuspensionChannel();
    };
  }, [sbUser, performSignOut, removeSuspensionChannel]);

  // ── Concurrent-session guard helpers ──────────────────────────────────────
  const startHeartbeat = useCallback(async (userId: string, token: string) => {
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    sessionStorage.setItem(ACTIVE_SESSION_TOKEN, token);
    await supabase
      .from("user_active_sessions")
      .upsert(
        { user_id: userId, session_token: token, last_heartbeat: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    heartbeatIntervalRef.current = setInterval(async () => {
      await supabase
        .from("user_active_sessions")
        .update({ last_heartbeat: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("session_token", token);
    }, 30_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopHeartbeat = useCallback(async (userId: string) => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    sessionStorage.removeItem(ACTIVE_SESSION_TOKEN);
    await supabase.from("user_active_sessions").delete().eq("user_id", userId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const u = session?.user ?? null;
        setSbUser(u);

        if (u) {
          await loadProfile(u);
          // Restore the device heartbeat for page-refresh scenarios.
          // sessionStorage survives F5 but NOT a new tab — new tabs are treated as new devices.
          const existingToken = sessionStorage.getItem(ACTIVE_SESSION_TOKEN);
          const token = existingToken ?? crypto.randomUUID();
          try { await startHeartbeat(u.id, token); } catch { /* table may not exist yet */ }
        }
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[Auth] erro em init:", e);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === "PASSWORD_RECOVERY") {
        setPasswordRecoveryOpen(true);
      }
      const u = session?.user ?? null;
      setSbUser(u);
      if (!u) {
        setProfile(null);
        setIsSuspended(false);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = async (email: string, senha: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      toast.error("Supabase não configurado");
      return false;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) {
      toast.error(friendlyAuthError(error.message));
      return false;
    }
    if (!data.session) {
      toast.error("Sessão não criada. Verifique seu e-mail e tente novamente.");
      return false;
    }
    const u = data.session.user;
    setSbUser(u);

    // ── Concurrent-session guard ────────────────────────────────────────────
    // Only block genuinely NEW logins from a different device/tab.
    // A page refresh keeps its sessionStorage token and is allowed through.
    const existingToken = sessionStorage.getItem(ACTIVE_SESSION_TOKEN);
    if (!existingToken) {
      try {
        const threshold = new Date(Date.now() - 90_000).toISOString();
        const { data: activeRow } = await supabase
          .from("user_active_sessions")
          .select("last_heartbeat")
          .eq("user_id", u.id)
          .gte("last_heartbeat", threshold)
          .maybeSingle();
        if (activeRow) {
          await supabase.auth.signOut();
          setSbUser(null);
          toast.error(
            "Esta conta já está em uso em outro dispositivo. Encerre a outra sessão antes de entrar.",
            { duration: 7000 },
          );
          return false;
        }
      } catch { /* table may not exist yet — allow login */ }
    }
    const sessionToken = existingToken ?? crypto.randomUUID();
    try { await startHeartbeat(u.id, sessionToken); } catch { /* table may not exist yet */ }
    // ───────────────────────────────────────────────────────────────────────

    const p = await loadProfile(u);
    if (!p) return false; // suspended users are blocked inside loadProfile
    const nome = p?.display_name || p?.name.split(" ")[0] || u.email?.split("@")[0] || "Doutor";
    toast.success(`Bem-vindo de volta, ${nome}!`);
    return true;
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      toast.error("Supabase não configurado");
      return false;
    }
    if (!data.email || !data.senha || !data.name) {
      toast.error("Preencha nome, e-mail e senha");
      return false;
    }
    const { data: signed, error } = await supabase.auth.signUp({
      email: data.email.trim(),
      password: data.senha,
      options: {
        data: {
          name: data.name,
          display_name: data.displayName ?? null,
          birth_date: data.birthDate ?? null,
          country: data.country ?? null,
          city_uf: data.cityUf ?? null,
          phone: data.phone ?? null,
        },
      },
    });
    if (error) {
      toast.error(friendlyAuthError(error.message));
      return false;
    }
    if (!signed.session) {
      toast.success("Conta criada! Verifique seu e-mail para confirmar e entrar.");
      return false;
    }
    const u = signed.session.user;
    setSbUser(u);
    await loadProfile(u);
    toast.success("Conta criada com sucesso!");
    return true;
  };

  const logout = async () => {
    if (sbUser) { try { await stopHeartbeat(sbUser.id); } catch { /* ignore */ } }
    await performSignOut();
    setIsSuspended(false);
  };

  const reloadProfile = useCallback(async () => {
    if (!sbUser) return;
    const p = await loadProfileFromDb(sbUser.id);
    if (p) setProfile(p);
  }, [sbUser]);

  const reloadSubscription = useCallback(async () => {
    if (!sbUser?.id) return;
    setIsSubscriptionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const sub = token ? await fetchSubscriptionFromApi(token) : null;
      setSubscription(sub);
    } catch {
      setSubscription(null);
    } finally {
      setIsSubscriptionLoading(false);
    }
  }, [sbUser?.id]);

  const updateProfile = async (
    changes: Partial<Pick<Profile, "name" | "display_name" | "country" | "city_uf" | "phone" | "birth_date" | "avatar_url">>,
  ): Promise<boolean> => {
    if (!sbUser) return false;
    const updated = await updateProfileService(sbUser.id, changes);
    if (!updated) {
      toast.error("Não foi possível atualizar o perfil");
      return false;
    }
    setProfile(updated);
    return true;
  };

  const user: User | null = sbUser ? supabaseUserToUser(sbUser, profile) : null;
  // ── Subscription loading — runs whenever the logged-in user changes ──────
  useEffect(() => {
    if (!sbUser?.id) {
      setSubscription(null);
      setIsSubscriptionLoading(false);
      return;
    }
    setIsSubscriptionLoading(true);
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const token = session?.access_token;
        return token ? fetchSubscriptionFromApi(token) : null;
      })
      .then((sub) => setSubscription(sub))
      .catch(() => setSubscription(null))
      .finally(() => setIsSubscriptionLoading(false));
  }, [sbUser?.id]);

  const isAuthenticated = !!sbUser;
  const isAdmin = !!(profile?.is_admin ?? (user?.role === "admin"));
  const isColaborador = !isAdmin && !!(profile?.is_colaborador ?? (user?.role === "colaborador"));
  const isMentor = !!(profile?.is_mentor);
  const isSubscribed = isAdmin || isColaborador || subscription?.status === "ativo";

  const value: AuthContextType = {
    user,
    profile,
    isAuthenticated,
    isAdmin,
    isColaborador,
    isMentor,
    isLoading,
    isSuspended,
    login,
    register,
    logout,
    reloadProfile,
    reloadSubscription,
    updateProfile,
    profileNetworkError,
    passwordRecoveryOpen,
    setPasswordRecoveryOpen,
    subscription,
    isSubscribed,
    isSubscriptionLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {isSuspended ? <SuspensionOverlay /> : children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
