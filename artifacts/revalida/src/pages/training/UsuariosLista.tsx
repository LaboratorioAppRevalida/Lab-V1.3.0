import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, Search, ChevronLeft, Users, Wifi, WifiOff, UserCheck, Star } from "lucide-react";
import { UserAvatar, type UserStatus } from "@/components/users/UserAvatar";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { useTraining } from "@/contexts/TrainingContext";
import { useRealtime } from "@/contexts/RealtimeContext";
import { InstaCheckButton } from "@/components/training/InstaCheckButton";
import { supabase } from "@/lib/supabase";

// ── Dados reais por usuário (carregados em lote) ────────────────────────────

type RealUserData = {
  nome: string;
  estacoes: number;
  avatarUrl: string | null;
};

async function fetchRealUserData(
  userIds: string[],
): Promise<Record<string, RealUserData>> {
  if (userIds.length === 0) return {};

  const [profilesResult, sessionsResult] = await Promise.all([
    supabase
      .from("profiles_public")
      .select("id, name, display_name, avatar_url")
      .in("id", userIds),
    supabase
      .from("sessions")
      .select("user_id")
      .in("user_id", userIds),
  ]);

  const sessionCounts: Record<string, number> = {};
  for (const s of (sessionsResult.data ?? []) as { user_id: string }[]) {
    sessionCounts[s.user_id] = (sessionCounts[s.user_id] ?? 0) + 1;
  }

  const result: Record<string, RealUserData> = {};
  for (const p of (profilesResult.data ?? []) as {
    id: string;
    name: string;
    display_name: string | null;
    avatar_url: string | null;
  }[]) {
    const nome = p.display_name?.trim() || p.name?.trim() || "Usuário";
    result[p.id] = {
      nome,
      estacoes: sessionCounts[p.id] ?? 0,
      avatarUrl: p.avatar_url ?? null,
    };
  }
  return result;
}

// ── Helpers de status / cor ────────────────────────────────────────────────

function statusLabel(u: { online: boolean; userStatus?: string; isReal?: boolean }): {
  text: string;
  color: string;
} {
  if (!u.online) return { text: "offline", color: "text-slate-500 dark:text-slate-400" };
  if (!u.isReal) return { text: "online", color: "text-emerald-600 dark:text-emerald-400 font-medium" };
  switch (u.userStatus) {
    case "in_session":
      return { text: "em sessão", color: "text-amber-600 dark:text-amber-400 font-medium" };
    case "busy":
      return { text: "ocupado", color: "text-orange-500 dark:text-orange-400 font-medium" };
    case "matchmaking":
      return { text: "buscando parceiro", color: "text-blue-600 dark:text-blue-400 font-medium" };
    default:
      return { text: "disponível", color: "text-emerald-600 dark:text-emerald-400 font-medium" };
  }
}

function resolveStatus(u: { online: boolean; userStatus?: string }): UserStatus {
  if (!u.online) return "offline";
  switch (u.userStatus) {
    case "in_session":  return "in_session";
    case "busy":        return "busy";
    case "matchmaking": return "matchmaking";
    default:            return "online";
  }
}

// ── Componente ─────────────────────────────────────────────────────────────

export default function UsuariosLista() {
  const { users, toggleFavorito, sendInvite, status, startSolo } = useTraining();
  const { isConnected, onlineUsers } = useRealtime();
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const [realData, setRealData] = useState<Record<string, RealUserData>>({});
  const fetchedKeyRef = useRef<string>("");

  useEffect(() => {
    if (status === "role-select") {
      setLocation("/treino/roles");
    }
  }, [status, setLocation]);

  useEffect(() => {
    const realIds = users
      .filter((u) => u.isReal)
      .map((u) => u.id)
      .sort();
    const key = realIds.join(",");
    if (key === fetchedKeyRef.current || realIds.length === 0) return;
    fetchedKeyRef.current = key;
    fetchRealUserData(realIds).then(setRealData);
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? users.filter((u) => {
          const nome = u.isReal ? (realData[u.id]?.nome ?? u.nome) : u.nome;
          return nome.toLowerCase().includes(q);
        })
      : users;

    return [...list].sort((a, b) => {
      const score = (u: typeof a) => {
        if (!u.online) return 0;
        let s = 1;
        if (u.isReal) s += 4;
        if (u.favorito) s += 2;
        return s;
      };
      return score(b) - score(a);
    });
  }, [users, search, realData]);

  const realOnlineCount = onlineUsers.length;
  const totalOnlineCount = users.filter((u) => u.online).length;

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => setLocation("/inicio")}
        className="self-start inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Voltar
      </button>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-1"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Treinar com colegas</h1>
            <p className="text-muted-foreground mt-1 font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              {totalOnlineCount} médicos online agora
              {realOnlineCount > 0 && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  · {realOnlineCount} reais
                </span>
              )}
            </p>
          </div>

          <div className={`flex items-center gap-1.5 text-xs font-medium mt-1 shrink-0 ${
            isConnected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          }`}>
            {isConnected
              ? <><Wifi className="w-3.5 h-3.5" /> ao vivo</>
              : <><WifiOff className="w-3.5 h-3.5" /> offline</>
            }
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <InstaCheckButton />
      </motion.div>

      {/* SOLO MODE CTA */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
      >
        <button
          onClick={() => { startSolo(); setLocation("/treino/solo"); }}
          className="w-full flex items-center gap-4 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.06)] transition-all group text-left"
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Treinar solo</div>
            <div className="text-xs text-muted-foreground">
              Pratique sem parceiro · timer real · auto-avaliação PEP
            </div>
          </div>
          <div className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors text-xs font-medium shrink-0">
            →
          </div>
        </button>
      </motion.div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar colega por nome"
          className="pl-10 h-12 rounded-2xl bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.02)] focus-visible:ring-blue-500"
        />
      </div>

      {/* CONTAINER PRINCIPAL DO PAINEL DA LISTA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-3 sm:p-4 shadow-[0_10px_30px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.02)] space-y-2.5 transition-all">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum colega encontrado.
          </div>
        )}
        <AnimatePresence initial={false}>
          {filtered.map((u, i) => {
            const displayNome = u.isReal ? (realData[u.id]?.nome ?? u.nome) : u.nome;
            const displayEstacoes = u.isReal ? (realData[u.id]?.estacoes ?? u.estacoes) : u.estacoes;

            const sl = statusLabel(u);
            const canInvite = u.online && u.userStatus !== "in_session" && u.userStatus !== "busy";
            const inviteDisabled = !u.online || u.userStatus === "in_session" || u.userStatus === "busy";

            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.25, delay: i * 0.02 }}
                className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border border-cyan-200/60 dark:border-slate-800 bg-gradient-to-r from-cyan-100/60 via-sky-100/40 to-purple-100/60 dark:bg-none dark:bg-slate-800/80 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-cyan-300/80 dark:hover:border-slate-700"
                onClick={u.isReal ? () => setLocation(`/perfil/${u.id}`) : undefined}
                role={u.isReal ? "button" : undefined}
                style={u.isReal ? { cursor: "pointer" } : undefined}
              >
                {/* Avatar */}
                <UserAvatar
                  name={displayNome}
                  avatarUrl={u.isReal ? (realData[u.id]?.avatarUrl ?? null) : null}
                  status={resolveStatus(u)}
                  size="md"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-sm sm:text-base truncate text-slate-800 dark:text-slate-100">
                      {displayNome}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {displayEstacoes > 0 && (
                      <>
                        <span>{displayEstacoes} estações</span>
                        <span className="opacity-60">·</span>
                      </>
                    )}
                    <span className={sl.color}>{sl.text}</span>
                  </div>
                </div>

                {/* Favoritar */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorito(u.id); }}
                  aria-label="Favoritar"
                  className={`shrink-0 p-2 rounded-xl transition-colors ${
                    u.favorito
                      ? "text-amber-500 hover:bg-amber-500/10"
                      : "text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  <Star className={`w-5 h-5 ${u.favorito ? "fill-current" : ""}`} />
                </button>

                {/* Convidar */}
                <button
                  onClick={(e) => { e.stopPropagation(); sendInvite(u.id); }}
                  disabled={inviteDisabled}
                  aria-label={
                    !u.online ? "Offline" :
                    u.userStatus === "in_session" ? "Em sessão" :
                    u.userStatus === "busy" ? "Ocupado" :
                    "Convidar"
                  }
                  title={
                    !u.online ? "Usuário offline" :
                    u.userStatus === "in_session" ? "Em sessão agora" :
                    u.userStatus === "busy" ? "Ocupado no momento" :
                    "Enviar convite"
                  }
                  className={`shrink-0 p-2 rounded-xl transition-colors ${
                    !inviteDisabled
                      ? "text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                      : "text-slate-400/40 cursor-not-allowed"
                  }`}
                >
                  <Mail className={`w-5 h-5 ${
                    !inviteDisabled && canInvite ? "" : "opacity-40"
                  }`} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}