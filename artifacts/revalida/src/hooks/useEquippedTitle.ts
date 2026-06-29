/**
 * useEquippedTitle — hook para buscar o título equipado do usuário logado.
 *
 * Uso: const { equippedTitle } = useEquippedTitle(user?.id);
 *
 * - Retorna null enquanto não carregado ou sem título equipado.
 * - Silencia erros de rede (sem console.error).
 * - Re-busca quando userId muda.
 */

import { useEffect, useState } from "react";
import { getEquippedTitle } from "@/lib/titleService";
import type { DbTitle } from "@/lib/titleService";

export function useEquippedTitle(userId: string | null | undefined) {
  const [equippedTitle, setEquippedTitle] = useState<DbTitle | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setEquippedTitle(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getEquippedTitle(userId)
      .then((t) => { if (!cancelled) setEquippedTitle(t); })
      .catch(() => { if (!cancelled) setEquippedTitle(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return { equippedTitle, equippedTitleLoading: loading, refreshEquippedTitle: () => {
    if (!userId) return;
    getEquippedTitle(userId)
      .then(setEquippedTitle)
      .catch(() => setEquippedTitle(null));
  }};
}
