import { supabase } from "./supabase";

export interface Profile {
  id: string;
  email: string;
  name: string;
  display_name: string | null;
  birth_date: string | null;
  country: string | null;
  city_uf: string | null;
  phone: string | null;
  is_admin: boolean;
  is_colaborador: boolean;
  xp_total: number;
  nivel: number;
  streak_atual: number;
  last_login_date: string | null;
  avatar_url: string | null;
  is_suspended: boolean;
  suspended_until: string | null;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * LGPD-safe public subset of a profile — read from `profiles_public` view.
 * Does NOT include email, phone, birth_date, or administrative columns.
 */
export interface PublicProfile {
  id: string;
  name: string;
  display_name: string | null;
  nivel: number;
  avatar_url: string | null;
  xp_total: number;
  streak_atual: number;
  city_uf: string | null;
  country: string | null;
  created_at: string;
}

export type ProfileUpsertInput = {
  id: string;
  email: string;
  name: string;
  display_name?: string | null;
  birth_date?: string | null;
  country?: string | null;
  city_uf?: string | null;
  phone?: string | null;
};

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[profileService] fetchProfile error", error);
    return null;
  }
  return data as Profile | null;
}

/**
 * Fetches a LGPD-safe public profile for ANY user via the `profiles_public`
 * security-barrier view. Unlike fetchProfile(), this works across RLS
 * boundaries — the view's SECURITY DEFINER function bypasses the
 * own-row-only restriction on the underlying profiles table.
 *
 * Use this for cross-user reads: public profile pages, lobby enrichment, etc.
 */
export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from("profiles_public")
    .select(
      "id, name, display_name, nivel, avatar_url, xp_total, streak_atual, city_uf, country, created_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[profileService] fetchPublicProfile error", error);
    return null;
  }
  return data as PublicProfile | null;
}

/**
 * Ensures a profile row exists for the given auth user. Used as a safety net
 * in case the database trigger that auto-creates profiles is not installed.
 */
export async function ensureProfile(input: ProfileUpsertInput): Promise<Profile | null> {
  const existing = await fetchProfile(input.id);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: input.id,
      email: input.email,
      name: input.name,
      display_name: input.display_name ?? null,
      birth_date: input.birth_date ?? null,
      country: input.country ?? null,
      city_uf: input.city_uf ?? null,
      phone: input.phone ?? null,
      is_admin: input.email === "admin@revalida.com",
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error("[profileService] ensureProfile error", error);
    return null;
  }
  return data as Profile | null;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function diffDays(aISO: string, bISO: string): number {
  const a = new Date(aISO + "T00:00:00").getTime();
  const b = new Date(bISO + "T00:00:00").getTime();
  return Math.round((a - b) / 86_400_000);
}

/**
 * Updates the user's daily login streak based on last_login_date.
 *  - same day  => no change
 *  - yesterday => +1
 *  - older / never => reset to 1
 */
export async function refreshStreak(profile: Profile): Promise<Profile> {
  const today = todayISO();
  if (profile.last_login_date === today) return profile;

  let newStreak = 1;
  if (profile.last_login_date) {
    const delta = diffDays(today, profile.last_login_date);
    if (delta === 1) newStreak = (profile.streak_atual ?? 0) + 1;
    else if (delta === 0) newStreak = profile.streak_atual ?? 1;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      streak_atual: newStreak,
      last_login_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[profileService] refreshStreak error", error);
    return profile;
  }
  return (data as Profile) ?? profile;
}

export async function updateProfile(
  userId: string,
  changes: Partial<Pick<Profile, "name" | "display_name" | "country" | "city_uf" | "phone" | "birth_date" | "xp_total" | "nivel" | "avatar_url">>,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[profileService] updateProfile error", error);
    return null;
  }
  return data as Profile | null;
}
