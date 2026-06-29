import { supabase } from "./supabase";
import type { Profile } from "./profileService";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdminUser = Profile & {
  sessionCount: number;
  warningCount: number;
};

export type AdminWarning = {
  id: string;
  user_id: string;
  admin_id: string;
  reason: string;
  created_at: string;
};

export type AdminSession = {
  id: string;
  user_id: string;
  parceiro_nome: string;
  checklist_nome: string;
  area: string | null;
  papel: string;
  nota: number;
  ended_at: string;
  created_at: string;
};

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Busca todos os usuários com contagens de sessões e advertências.
 * Requer que o chamador seja admin (policy via RLS).
 */
export async function fetchAllUsersAdmin(): Promise<AdminUser[]> {
  const [profilesResult, sessionsResult, warningsResult] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("sessions").select("user_id"),
    supabase.from("user_warnings").select("user_id"),
  ]);

  const sessionCounts: Record<string, number> = {};
  for (const s of (sessionsResult.data ?? []) as { user_id: string }[]) {
    sessionCounts[s.user_id] = (sessionCounts[s.user_id] ?? 0) + 1;
  }

  const warnCounts: Record<string, number> = {};
  for (const w of (warningsResult.data ?? []) as { user_id: string }[]) {
    warnCounts[w.user_id] = (warnCounts[w.user_id] ?? 0) + 1;
  }

  return ((profilesResult.data ?? []) as Profile[]).map((p) => ({
    ...p,
    sessionCount: sessionCounts[p.id] ?? 0,
    warningCount: warnCounts[p.id] ?? 0,
  }));
}

export async function fetchUserSessions(userId: string): Promise<AdminSession[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("ended_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data as AdminSession[];
}

export async function fetchUserWarnings(userId: string): Promise<AdminWarning[]> {
  const { data, error } = await supabase
    .from("user_warnings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as AdminWarning[];
}

// ── Mutations (todas requerem is_admin via RLS) ───────────────────────────────

export async function adminUpdateProfile(
  userId: string,
  changes: {
    name?: string;
    display_name?: string | null;
    city_uf?: string | null;
    phone?: string | null;
    birth_date?: string | null;
  },
): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return !error;
}

export async function adminResetMetrics(userId: string): Promise<boolean> {
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      xp_total: 0,
      nivel: 1,
      streak_atual: 0,
      last_login_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileErr) return false;

  const { error: sessErr } = await supabase
    .from("sessions")
    .delete()
    .eq("user_id", userId);

  return !sessErr;
}

export async function adminSuspendUser(
  userId: string,
  reason: string,
  suspendedUntil: Date | null,
): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({
      is_suspended: true,
      suspended_until: suspendedUntil?.toISOString() ?? null,
      suspension_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  return !error;
}

export async function adminUnsuspendUser(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({
      is_suspended: false,
      suspended_until: null,
      suspension_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  return !error;
}

export async function adminWarnUser(
  userId: string,
  adminId: string,
  reason: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("user_warnings")
    .insert({ user_id: userId, admin_id: adminId, reason });
  return !error;
}

export async function adminPromoteToAdmin(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: true, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return !error;
}

export async function adminPromoteToColaborador(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({ is_colaborador: true, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return !error;
}

export async function adminDemoteFromColaborador(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({ is_colaborador: false, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return !error;
}

export async function adminDemoteFromAdmin(
  userId: string,
  currentAdminId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (userId === currentAdminId) {
    return { ok: false, reason: "Você não pode remover seus próprios privilégios de admin." };
  }

  const { data: admins, error: countErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true);

  if (countErr) return { ok: false, reason: "Erro ao verificar administradores." };

  if ((admins ?? []).length <= 1) {
    return { ok: false, reason: "Não é possível remover o único administrador do sistema." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: false, updated_at: new Date().toISOString() })
    .eq("id", userId);

  return error ? { ok: false, reason: "Erro ao remover privilégios." } : { ok: true };
}
