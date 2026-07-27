import { supabase } from "./supabase";

export type AppSettings = {
  whatsapp: string;
  email_suporte: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  whatsapp: "5511999999999",
  email_suporte: "suporte@revalida.app",
};

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value");

  if (error || !data) return { ...DEFAULT_SETTINGS };

  const result: AppSettings = { ...DEFAULT_SETTINGS };
  for (const row of data as { key: string; value: string }[]) {
    if (row.key === "whatsapp") result.whatsapp = row.value;
    if (row.key === "email_suporte") result.email_suporte = row.value;
  }
  return result;
}

export async function upsertAppSetting(
  key: keyof AppSettings,
  value: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  return !error;
}
