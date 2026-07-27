import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Trophy, Crown, Flame, Layers, Medal, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateLevel, levelName } from "@/lib/levelSystem";
import {
  fetchNotaRanking,
  fetchAreaRanking,
  fetchXpRanking,
  fetchStreakRanking,
  fetchWeeklyRanking,
  type NotaRankRow,
  type AreaRankRow,
  type XpRankRow,
  type StreakRankRow,
  type WeeklyRankRow,
} from "@/lib/rankingService";
import { fetchEquippedTitlesByUserIds, type DbTitle } from "@/lib/titleService";
import { TitleBadge } from "@/components/gamification/TitleBadge";

type RankingTab = "geral" | "areas" | "xp" | "constancia" | "semana";

const AREAS = ["Clínica médica", "Cirurgia", "Pediatria", "GO", "MFC"];

type RankRow = {
  id: string;
  nome: string;
  nivel: number;
  score: number;
  detail: string;
  isMe: boolean;
};

const SCORE_UNIT: Record<RankingTab, string> = {
  geral: "/ 10",
  areas: "/ 10",
  xp: "XP",
  constancia: "dias",
  semana: "est.",
};

export default function Rankings() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<RankingTab>("geral");
  const [areaFilter, setAreaFilter] = useState<string>(AREAS[0]);
  const [rows, setRows] = useState<RankRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [equippedTitles, setEquippedTitles] = useState<Map<string, DbTitle>>(new Map());

  const meId = user?.id ?? null;
  const meName =
    profile?.name ||
    user?.displayName ||
    user?.name ||
    user?.email?.split("@")[0] ||
    "Você";

  function fromNota(data: NotaRankRow[]): RankRow[] {
    return data.map((r) => ({
      id: r.id,
      nome: r.name,
      nivel: r.nivel ?? 1,
      score: Number(r.media_nota ?? 0),
      detail: `${r.total_estacoes} est. · média ${Number(r.media_nota ?? 0).toFixed(1)}`,
      isMe: r.id === meId,
    }));
  }

  function fromArea(data: AreaRankRow[]): RankRow[] {
    return data.map((r) => ({
      id: r.id,
      nome: r.name,
      nivel: r.nivel ?? 1,
      score: Number(r.media_nota ?? 0),
      detail: `${r.total_estacoes} est. · nota ${Number(r.media_nota ?? 0).toFixed(1)}`,
      isMe: r.id === meId,
    }));
  }

  function fromXp(data: XpRankRow[]): RankRow[] {
    return data.map((r) => {
      const lvl = calculateLevel(r.xp_total);
      return {
        id: r.id,
        nome: r.name,
        nivel: lvl,
        score: r.xp_total,
        detail: `Nível ${lvl} · ${levelName(lvl)}`,
        isMe: r.id === meId,
      };
    });
  }

  function fromStreak(data: StreakRankRow[]): RankRow[] {
    return data.map((r) => ({
      id: r.id,
      nome: r.name,
      nivel: r.nivel ?? 1,
      score: r.streak_atual,
      detail: "dias seguidos",
      isMe: r.id === meId,
    }));
  }

  function fromWeekly(data: WeeklyRankRow[]): RankRow[] {
    return data.map((r) => ({
      id: r.id,
      nome: r.name,
      nivel: r.nivel ?? 1,
      score: r.estacoes_semana,
      detail: "est. nos últimos 7 dias",
      isMe: r.id === meId,
    }));
  }

  useEffect(() => {
    setIsLoading(true);
    setRows([]);

    const load = async () => {
      try {
        if (tab === "geral") {
          const data = await fetchNotaRanking();
          setRows(fromNota(data));
        } else if (tab === "areas") {
          const data = await fetchAreaRanking(areaFilter);
          setRows(fromArea(data));
        } else if (tab === "xp") {
          const data = await fetchXpRanking();
          setRows(fromXp(data));
        } else if (tab === "constancia") {
          const data = await fetchStreakRanking();
          setRows(fromStreak(data));
        } else {
          const data = await fetchWeeklyRanking();
          setRows(fromWeekly(data));
        }
      } catch (e) {
        console.warn("[Rankings] load error:", e);
        setRows([]);
      } finally {
        setIsLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, areaFilter, meId]);

  useEffect(() => {
    if (rows.length === 0) return;
    const ids = rows.map((r) => r.id);
    fetchEquippedTitlesByUserIds(ids)
      .then(setEquippedTitles)
      .catch(() => setEquippedTitles(new Map()));
  }, [rows]);

  const myPosition = rows.findIndex((r) => r.isMe) + 1;
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const unit = SCORE_UNIT[tab];

  const tabs: { id: RankingTab; label: string; icon: typeof Trophy }[] = [
    { id: "geral", label: "Geral", icon: Trophy },
    { id: "areas", label: "Por área", icon: Layers },
    { id: "xp", label: "Nível", icon: Zap },
    { id: "constancia", label: "Constância", icon: Flame },
    { id: "semana", label: "Semana", icon: Medal },
  ];

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1 pt-2"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-muted-foreground">
          <Trophy className="w-3.5 h-3.5" /> Rankings
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Sua posição</h1>
        <p className="text-muted-foreground mt-1 font-medium">
          Compare seu desempenho com a comunidade
        </p>
      </motion.div>

      {/* TABS */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all border",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* AREA FILTER */}
      {tab === "areas" && (
        <div className="flex flex-wrap gap-2">
          {AREAS.map((a) => (
            <button
              key={a}
              onClick={() => setAreaFilter(a)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border",
                areaFilter === a
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border/60 hover:border-foreground/40",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {/* TAB DESCRIPTION */}
      {tab === "geral" && (
        <p className="text-xs text-muted-foreground px-1">
          Média geral de notas das estações concluídas
        </p>
      )}
      {tab === "xp" && (
        <p className="text-xs text-muted-foreground px-1">
          XP acumulado via missões e conquistas
        </p>
      )}

      {/* LOADING */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 flex flex-col items-center text-center rounded-2xl border-dashed border-2 border-border/60">
          <Trophy className="w-8 h-8 text-muted-foreground mb-3 opacity-50" />
          <p className="font-semibold text-muted-foreground">Nenhum dado disponível ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Complete sessões de treino para aparecer no ranking.
          </p>
        </Card>
      ) : (
        <>
          {/* PODIUM */}
          <Podium top3={top3} unit={unit} tab={tab} />

          {/* MY POSITION CARD */}
          {myPosition > 0 && (
            <Card className="rounded-2xl p-4 border-primary/30 bg-gradient-to-br from-blue-500/15 via-cyan-500/10 to-violet-500/15 backdrop-blur-md flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-white font-extrabold text-base shrink-0 glow-primary">
                #{myPosition}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Sua posição
                </div>
                <div className="font-bold text-base truncate">{meName}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-extrabold tabular-nums text-gradient-primary">
                  {(tab === "geral" || tab === "areas")
                    ? rows[myPosition - 1].score.toFixed(1)
                    : rows[myPosition - 1].score}
                </div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase">
                  {unit}
                </div>
              </div>
            </Card>
          )}

          {/* LIST (posições 4+) */}
          {rest.length > 0 && (
            <Card className="rounded-2xl border-border/60 overflow-hidden divide-y divide-border/60">
              {rest.map((r, i) => (
                <RankRowItem
                  key={r.id}
                  row={r}
                  position={i + 4}
                  unit={unit}
                  tab={tab}
                  equippedTitle={equippedTitles.get(r.id) ?? null}
                />
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Podium ──

function Podium({ top3, unit, tab }: { top3: RankRow[]; unit: string; tab: RankingTab }) {
  if (top3.length === 0) return null;

  const podiumOrder: {
    row: RankRow;
    pos: number;
    height: string;
    tier: "ouro" | "prata" | "bronze";
  }[] = [];
  if (top3[1]) podiumOrder.push({ row: top3[1], pos: 2, height: "h-20", tier: "prata" });
  podiumOrder.push({ row: top3[0], pos: 1, height: "h-28", tier: "ouro" });
  if (top3[2]) podiumOrder.push({ row: top3[2], pos: 3, height: "h-16", tier: "bronze" });

  const tierStyles = {
    ouro: "from-yellow-400 via-yellow-500 to-amber-500 shadow-[0_0_30px_-4px_rgba(234,179,8,0.7)]",
    prata:
      "from-slate-300 via-slate-400 to-slate-500 shadow-[0_0_24px_-6px_rgba(148,163,184,0.7)]",
    bronze:
      "from-amber-700 via-amber-600 to-amber-800 shadow-[0_0_24px_-6px_rgba(180,83,9,0.6)]",
  };
  const labels = { ouro: "1º", prata: "2º", bronze: "3º" };

  return (
    <div className="relative grid grid-cols-3 gap-3 items-end pt-6">
      {podiumOrder.map((p, idx) => {
        const initials = p.row.nome
          .split(" ")
          .slice(0, 2)
          .map((s) => s[0])
          .join("")
          .toUpperCase();
        const scoreDisplay =
          tab === "geral" || tab === "areas"
            ? p.row.score.toFixed(1)
            : String(p.row.score);
        return (
          <motion.div
            key={p.row.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
            className="flex flex-col items-center gap-2"
          >
            {p.tier === "ouro" && (
              <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            )}
            <div
              className={cn(
                "relative rounded-2xl w-14 h-14 flex items-center justify-center text-white font-extrabold text-sm bg-gradient-to-br",
                tierStyles[p.tier],
                p.row.isMe && "ring-4 ring-primary/60",
              )}
            >
              {initials}
            </div>
            <div className="text-[11px] font-bold text-center leading-tight line-clamp-2 px-1">
              {p.row.nome}
            </div>
            <div className="text-xs font-extrabold tabular-nums">
              {scoreDisplay}{" "}
              <span className="text-[9px] font-bold text-muted-foreground">{unit}</span>
            </div>
            <div
              className={cn(
                "w-full rounded-t-2xl bg-gradient-to-b backdrop-blur-md border-x border-t border-white/20 flex items-start justify-center pt-2 text-white text-xs font-extrabold",
                p.height,
                tierStyles[p.tier],
              )}
            >
              {labels[p.tier]}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── RankRowItem ──

function RankRowItem({
  row,
  position,
  unit,
  tab,
  equippedTitle,
}: {
  row: RankRow;
  position: number;
  unit: string;
  tab: RankingTab;
  equippedTitle: DbTitle | null;
}) {
  const initials = row.nome
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  const scoreDisplay =
    tab === "geral" || tab === "areas" ? row.score.toFixed(1) : String(row.score);

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3.5 transition-colors",
        row.isMe
          ? "bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-violet-500/10"
          : "hover:bg-muted/40",
      )}
    >
      <div
        className={cn(
          "w-9 text-center text-sm font-extrabold tabular-nums shrink-0",
          row.isMe ? "text-gradient-primary" : "text-muted-foreground",
        )}
      >
        #{position}
      </div>
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0",
          row.isMe ? "gradient-primary text-white" : "bg-muted text-muted-foreground",
        )}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("font-semibold truncate text-sm", row.isMe && "font-bold")}>
          {row.nome}
          {row.isMe && (
            <span className="ml-1.5 text-[9px] uppercase tracking-wider font-bold text-primary">
              · você
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="text-[11px] text-muted-foreground truncate">{row.detail}</div>
          {equippedTitle && (
            <TitleBadge title={equippedTitle} size="xs" />
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-base font-extrabold tabular-nums">{scoreDisplay}</div>
        <div className="text-[9px] text-muted-foreground font-bold uppercase">{unit}</div>
      </div>
    </div>
  );
}
