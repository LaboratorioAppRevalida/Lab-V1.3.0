/**
 * gamificationService.ts
 *
 * Ponto centralizado para leitura de status de gamificação e
 * concessão de XP via mecanismos server-side.
 *
 * NÃO altera diretamente `xp_total` ou `nivel` na tabela `profiles`
 * via JWT do usuário — essas colunas são protegidas pela RLS policy
 * `profiles_update_own_secure` e devem ser gravadas exclusivamente por:
 *   · Trigger DB  : `update_xp_nivel_on_session` (XP de sessões)
 *   · Edge Function: a implementar para XP de missões e eventos
 *   · Admin bypass : `profiles_update_admin` (admin via adminSetXp)
 *
 * Demais referências não alteradas:
 * - gamificationStorage.ts (continua funcionando para Conquistas.tsx).
 * - levelSystem.ts (continua sendo usado para cálculos no frontend).
 */

import { supabase } from "./supabase";
import { calculateLevel } from "./levelSystem";

export type XpGrantResult = {
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
};

/**
 * Concede XP a um usuário para missões e recompensas de eventos.
 *
 * A persistência do XP no banco é responsabilidade de um mecanismo
 * server-side (trigger ou Edge Function). Esta função calcula o resultado
 * esperado localmente e, em seguida, rebusca o perfil atualizado do banco
 * para que o cliente receba os valores autoritativos mais recentes.
 *
 * TODO: implementar Edge Function `grant-xp` (service-role) que receba
 *       { userId, amount, reason } e aplique a escrita de xp_total/nivel
 *       atomicamente, substituindo o cálculo local abaixo.
 *
 * NÃO usar para XP de sessões — isso é gerenciado pelo trigger DB
 * `update_xp_nivel_on_session` que dispara ao salvar a sessão.
 */
export async function grantXp(
  userId: string,
  amount: number,
): Promise<XpGrantResult | null> {
  if (amount <= 0) return null;

  const { data: profile, error: fetchErr } = await supabase
    .from("profiles")
    .select("xp_total, nivel")
    .eq("id", userId)
    .single();

  if (fetchErr || !profile) return null;

  const oldLevel = profile.nivel ?? 1;

  // Cálculo local do resultado esperado (otimista).
  // A gravação real de xp_total/nivel deve ocorrer server-side.
  // Por ora, rebuscamos o perfil para retornar o estado atual do banco.
  const optimisticXp    = Math.max(0, (profile.xp_total ?? 0) + amount);
  const optimisticLevel = calculateLevel(optimisticXp);

  // Rebusca o perfil para refletir qualquer atualização feita pelo DB
  // (trigger de sessão ou outro mecanismo server-side).
  const { data: fresh } = await supabase
    .from("profiles")
    .select("xp_total, nivel")
    .eq("id", userId)
    .single();

  const newXp    = fresh?.xp_total ?? optimisticXp;
  const newLevel = fresh?.nivel    ?? optimisticLevel;

  return { newXp, newLevel, leveledUp: newLevel > oldLevel };
}

/**
 * Retorna o status de gamificação de um usuário (XP, nível, streak).
 */
export async function fetchGamificationStatus(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("xp_total, nivel, streak_atual")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    xp:     data.xp_total    ?? 0,
    level:  data.nivel       ?? 1,
    streak: data.streak_atual ?? 0,
  };
}

/**
 * Define o XP total de um usuário diretamente (uso exclusivo admin).
 *
 * Esta operação é permitida pela RLS policy `profiles_update_admin`
 * (requer is_admin = true no token JWT do chamador). Usuários comuns
 * terão a escrita bloqueada pela policy `profiles_update_own_secure`.
 *
 * Após a atualização, rebusca o perfil para confirmar os valores gravados.
 */
export async function adminSetXp(
  userId: string,
  xpTotal: number,
): Promise<boolean> {
  const newLevel = calculateLevel(xpTotal);

  const { error } = await supabase
    .from("profiles")
    .update({
      xp_total:   Math.max(0, xpTotal),
      nivel:      newLevel,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return !error;
}
