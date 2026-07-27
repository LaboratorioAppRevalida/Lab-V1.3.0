import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  TrendingUp,
  Flame,
  CalendarRange,
  Repeat2,
  Stethoscope,
  UserRound,
  Filter,
  Loader2,
  BarChart2,
  WifiOff,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTraining, type SavedSession, type Role } from "@/contexts/TrainingContext";
import { useAuth } from "@/contexts/AuthContext";
import { fetchSessionsPage } from "@/lib/sessionService";
import { toast } from "sonner";

const PAGE_SIZE = 10;

type AreaFilter = "Todas" | "CM" | "CIR" | "PE" | "GO" | "MF";
type RoleFilter = "Todos" | "medico" | "paciente";

const AREA_LABEL_TO_FULL: Record<Exclude<AreaFilter, "Todas">, string> = {
  CM: "Clínica médica",
  CIR: "Cirurgia",
  PE: "Pediatria",
  GO: "GO",
  MF: "MFC",
};

const AREA_FILTERS: AreaFilter[] = ["Todas", "CM", "CIR", "PE", "GO", "MF"];
const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "Todos", label: "Todos" },
  { value: "medico", label: "Médico" },
  { value: "paciente", label: "Paciente" },
];

const AREA_FULL_NAMES = [
  "Clínica médica",
  "Cirurgia",
  "Pediatria",
  "GO",
  "MFC",
];

function formatDateBR(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatChartDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function nota10(s: SavedSession) {
  if (s.notaMaxima <= 0) return 0;
  return Math.round((s.notaTotal / s.notaMaxima) * 10 * 100) / 100;
}

function titleMatchesArea(title: string, areaFull: string): boolean {
  const t = title.toLowerCase();
  const a = areaFull.toLowerCase();
  if (t.includes(a)) return true;
  if (areaFull === "Clínica médica" && (t.includes("clínica") || t.includes("cm"))) return true;
  if (areaFull === "Cirurgia" && (t.includes("cirurg") || t.includes("cir"))) return true;
  if (areaFull === "Pediatria" && t.includes("pediatr")) return true;
  if (areaFull === "GO" && (t.includes("ginec") || t.includes("obstetr") || t.includes("go"))) return true;
  if (areaFull === "MFC" && (t.includes("família") || t.includes("comunidade") || t.includes("mfc"))) return true;
  return false;
}

export default function Progresso() {
  // ── Context data (stats + gamification) ───────────────────────────────────
  const { history, isLoadingHistory, repeatStation, hasNetworkError, retryLoad } = useTraining();
  const { profile, user } = useAuth();
  const [, setLocation] = useLocation();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [areaFilter, setAreaFilter] = useState<AreaFilter>("Todas");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("Todos");

  // ── Paginated history list state ──────────────────────────────────────────
  // Separate from the context `history` which is used for stats + gamification.
  // These values track only the list displayed in the "Histórico" section.
  const [pagedItems, setPagedItems] = useState<SavedSession[]>([]);
  const [listPage, setListPage] = useState(0);
  const [listHasMore, setListHasMore] = useState(false);
  const [listTotalCount, setListTotalCount] = useState(0);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const userId = user?.id ?? null;

  // ── Server-side paginated fetch ────────────────────────────────────────────
  // Role and area are passed to Supabase so only relevant rows travel the wire.
  // Each call uses .range(from, to) + count:'exact' — no full-table scan on
  // the client side, constant O(pageSize) DOM updates instead of O(totalRows).
  const loadPage = useCallback(
    async (uid: string, page: number, role: RoleFilter, area: AreaFilter, append: boolean) => {
      const roleArg = role !== "Todos" ? (role as Role) : undefined;
      const areaArg = area !== "Todas" ? AREA_LABEL_TO_FULL[area as Exclude<AreaFilter, "Todas">] : undefined;

      try {
        const result = await fetchSessionsPage(uid, page, PAGE_SIZE, roleArg, areaArg);
        setPagedItems((prev) => append ? [...prev, ...result.data] : result.data);
        setListHasMore(result.hasMore);
        setListTotalCount(result.totalCount);
      } catch (e) {
        console.warn("[Progresso] fetchSessionsPage error:", e);
      }
    },
    [],
  );

  // Reset and re-fetch when userId or either filter changes
  useEffect(() => {
    if (!userId) {
      setPagedItems([]);
      setListPage(0);
      setListHasMore(false);
      setListTotalCount(0);
      return;
    }
    setPagedItems([]);
    setListPage(0);
    setIsLoadingList(true);
    loadPage(userId, 0, roleFilter, areaFilter, false).finally(() => {
      setIsLoadingList(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, roleFilter, areaFilter]);

  const handleLoadMore = useCallback(() => {
    if (!userId || !listHasMore || isLoadingMore) return;
    const nextPage = listPage + 1;
    setListPage(nextPage);
    setIsLoadingMore(true);
    loadPage(userId, nextPage, roleFilter, areaFilter, true).finally(() => {
      setIsLoadingMore(false);
    });
  }, [userId, listHasMore, isLoadingMore, listPage, roleFilter, areaFilter, loadPage]);

  // ── Stats — use full context history (unchanged, safe for gamification) ────
  const stats = useMemo(() => {
    if (history.length === 0) {
      return { media: 0, semana: 0, constancia: profile?.streak_atual ?? 0 };
    }
    const notas = history.map(nota10);
    const media = notas.reduce((a, b) => a + b, 0) / notas.length;
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const semana = history.filter((s) => new Date(s.endedAt).getTime() >= oneWeekAgo).length;
    return {
      media: Math.round(media * 100) / 100,
      semana,
      constancia: profile?.streak_atual ?? 0,
    };
  }, [history, profile?.streak_atual]);

  const areaStats = useMemo(() => {
    return AREA_FULL_NAMES.map((areaFull) => {
      const sessions = history.filter((s) => {
        // Prefer the server-authoritative `area` column; fall back to title keywords.
        if (s.area) return s.area.toLowerCase() === areaFull.toLowerCase();
        return titleMatchesArea(s.checklistTitle, areaFull);
      });
      if (sessions.length === 0) return { area: areaFull, media: null, total: 0 };
      const notas = sessions.map(nota10);
      const media = notas.reduce((a, b) => a + b, 0) / notas.length;
      return { area: areaFull, media: Math.round(media * 100) / 100, total: sessions.length };
    }).filter((a) => a.total > 0);
  }, [history]);

  const chartData = useMemo(() => {
    return [...history]
      .sort((a, b) => a.endedAt.localeCompare(b.endedAt))
      .slice(-30)
      .map((s) => ({
        date: formatChartDate(s.endedAt),
        nota: nota10(s),
        title: s.checklistTitle,
      }));
  }, [history]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRepeat = (s: SavedSession) => {
    if (!s.checklistId) {
      toast.error("Esta estação não pode ser repetida (dados históricos incompletos).");
      return;
    }
    const ok = repeatStation(
      s.checklistId,
      s.role,
      (s.tempoMin as 8 | 9 | 10) ?? 10,
    );
    if (!ok) {
      toast.error("Checklist não encontrado. Pode ter sido excluído.");
      return;
    }
    setLocation("/treino/estacao");
  };

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1 pt-2"
      >
        <h1 className="text-3xl font-bold tracking-tight">Progresso</h1>
        <p className="text-muted-foreground mt-1 font-medium">
          Acompanhe sua evolução nas estações práticas
        </p>
      </motion.div>

      {isLoadingHistory && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando histórico...
        </div>
      )}

      {hasNetworkError && !isLoadingHistory && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 flex flex-col items-center gap-4 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
            <WifiOff className="w-6 h-6 text-destructive" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-sm text-foreground">Falha de conexão</p>
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar os seus dados devido a uma falha de conexão.
            </p>
          </div>
          <button
            onClick={() => retryLoad()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* RESUMO GERAL — uses full context history, unchanged */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          tone="blue"
          label="Média geral"
          value={history.length > 0 ? stats.media.toFixed(2) : "—"}
          suffix={history.length > 0 ? "/ 10" : undefined}
        />
        <StatCard
          icon={<CalendarRange className="w-4 h-4" />}
          tone="violet"
          label="Estações na semana"
          value={String(stats.semana)}
        />
        <StatCard
          icon={<Flame className="w-4 h-4" />}
          tone="amber"
          label="Constância"
          value={String(stats.constancia)}
          suffix={stats.constancia === 1 ? "dia" : "dias"}
        />
      </div>

      {/* CONTADORES DE SESSÕES — uses full context history, unchanged */}
      {history.length > 0 && (
        <Card className="rounded-2xl p-5 border-border/60 backdrop-blur-md bg-card/70">
          <div className="flex items-center gap-2 mb-4">
            <Stethoscope className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-base">Sessões por papel</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Médico",
                value: history.filter((s) => s.role === "medico").length,
                tone: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
              },
              {
                label: "Paciente",
                value: history.filter((s) => s.role === "paciente").length,
                tone: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
              },
              {
                label: "Total",
                value: listTotalCount > history.length ? listTotalCount : history.length,
                tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
              },
            ].map(({ label, value, tone }) => (
              <div
                key={label}
                className={`rounded-xl p-3 flex flex-col items-center gap-1 ${tone}`}
              >
                <span className="text-2xl font-extrabold tabular-nums">{value}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* MÉDIA POR ÁREA — uses full context history, unchanged */}
      {areaStats.length > 0 && (
        <Card className="rounded-2xl p-5 border-border/60 backdrop-blur-md bg-card/70">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-base">Média por área</h3>
          </div>
          <div className="flex flex-col gap-3">
            {areaStats.map(({ area, media, total }) => {
              const pct = media !== null ? (media / 10) * 100 : 0;
              const color =
                pct >= 70
                  ? "from-emerald-500 to-cyan-500"
                  : pct >= 50
                  ? "from-blue-500 to-violet-500"
                  : "from-amber-500 to-rose-500";
              return (
                <div key={area} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{area}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {media !== null ? `${media.toFixed(2)} / 10` : "—"}
                      <span className="ml-2 opacity-60">({total} estaç{total === 1 ? "ão" : "ões"})</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* GRÁFICO — uses full context history, unchanged */}
      <Card className="rounded-2xl p-5 border-border/60 backdrop-blur-md bg-card/70">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base">Evolução das notas</h3>
            <p className="text-xs text-muted-foreground">Últimas estações encerradas</p>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {chartData.length} estaç{chartData.length === 1 ? "ão" : "ões"}
          </div>
        </div>
        <div className="h-64">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border/60 rounded-xl">
              {isLoadingHistory
                ? "Carregando..."
                : "Salve sua primeira estação para começar a ver o gráfico."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="evolucao" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 10]}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ fontWeight: 600 }}
                  formatter={(value: number) => [value.toFixed(2), "Nota"]}
                />
                <Line
                  type="monotone"
                  dataKey="nota"
                  stroke="url(#evolucao)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#06b6d4", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* ── HISTÓRICO PAGINADO ─────────────────────────────────────────────────
          The list below uses its own server-side paginated state (pagedItems).
          Only PAGE_SIZE rows are fetched per request using .range(from, to) +
          count:'exact'. Role and area filters are applied at the DB layer so
          every returned row is relevant — no wasted bytes or hidden DOM nodes.

          The stats cards, area bars, and evolution chart above continue to use
          the full `history` array from TrainingContext (unchanged), so they
          are completely unaffected by this pagination.
      ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Histórico de estações</h3>
          {listTotalCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {pagedItems.length} de {listTotalCount}
            </span>
          )}
        </div>

        {/* FILTROS */}
        <div className="flex flex-col gap-3">
          <FilterRow
            label="Área"
            options={AREA_FILTERS.map((a) => ({ value: a, label: a }))}
            value={areaFilter}
            onChange={(v) => setAreaFilter(v as AreaFilter)}
          />
          <FilterRow
            label="Papel"
            options={ROLE_FILTERS}
            value={roleFilter}
            onChange={(v) => setRoleFilter(v as RoleFilter)}
          />
        </div>

        <div className="flex flex-col gap-3">
          {/* Initial loading skeleton */}
          {isLoadingList && (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-muted/40 border border-border/40 p-5 flex items-center gap-4 animate-pulse"
                >
                  <div className="w-12 h-12 rounded-xl bg-muted/70 shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="h-4 w-2/3 rounded bg-muted/70" />
                    <div className="h-3 w-1/2 rounded bg-muted/50" />
                  </div>
                  <div className="w-12 h-8 rounded bg-muted/70 shrink-0" />
                </div>
              ))}
            </>
          )}

          {/* Empty state */}
          {!isLoadingList && pagedItems.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
              {listTotalCount === 0 && areaFilter === "Todas" && roleFilter === "Todos"
                ? "Você ainda não salvou nenhuma estação. Complete uma estação e clique em Salvar."
                : "Nenhuma estação encontrada com esses filtros."}
            </div>
          )}

          {/* Session cards */}
          {!isLoadingList &&
            pagedItems.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i % PAGE_SIZE, 5) * 0.04 }}
                whileHover={{ y: -2 }}
                className="rounded-2xl backdrop-blur-sm bg-white/70 dark:bg-slate-900/60 border border-border/60 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
              >
                <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                  s.role === "medico"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-300"
                    : "bg-violet-500/10 text-violet-600 dark:text-violet-300"
                }`}>
                  {s.role === "medico" ? <Stethoscope className="w-5 h-5" /> : <UserRound className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm sm:text-base leading-tight truncate">
                    {s.checklistTitle}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>com {s.partnerName}</span>
                    <span className="opacity-70">· {s.role === "medico" ? "Médico" : "Paciente"}</span>
                    {s.tempoMin > 0 && (
                      <span className="opacity-70">· {s.tempoMin} min</span>
                    )}
                    <span className="opacity-70">· {formatDateBR(s.endedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1 shrink-0">
                  <div className="text-right">
                    <div className="text-xl font-extrabold tabular-nums text-gradient-primary leading-none">
                      {nota10(s).toFixed(2)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-0.5">
                      de 10.00
                    </div>
                  </div>
                  {s.checklistId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRepeat(s)}
                      className="rounded-xl"
                    >
                      <Repeat2 className="w-4 h-4 mr-1.5" />
                      Repetir
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}

          {/* Load more skeleton — shown while fetching next page */}
          {isLoadingMore && (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={`more-${i}`}
                  className="rounded-2xl bg-muted/40 border border-border/40 p-5 flex items-center gap-4 animate-pulse"
                >
                  <div className="w-12 h-12 rounded-xl bg-muted/70 shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="h-4 w-2/3 rounded bg-muted/70" />
                    <div className="h-3 w-1/2 rounded bg-muted/50" />
                  </div>
                  <div className="w-12 h-8 rounded bg-muted/70 shrink-0" />
                </div>
              ))}
            </>
          )}

          {/* Carregar Mais button — hidden when no more pages */}
          {!isLoadingList && listHasMore && (
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="w-full h-12 rounded-2xl border-border/60 text-sm font-semibold mt-1"
            >
              {isLoadingMore ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ChevronDown className="w-4 h-4 mr-2" />
              )}
              {isLoadingMore ? "Carregando..." : "Carregar Mais"}
            </Button>
          )}

          {/* End-of-list marker */}
          {!isLoadingList && !listHasMore && pagedItems.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-2">
              {pagedItems.length === 1
                ? "1 estação exibida"
                : `Todas as ${pagedItems.length} estações exibidas`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  tone,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  tone: "blue" | "violet" | "amber";
  label: string;
  value: string;
  suffix?: string;
}) {
  const toneMap = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  };
  return (
    <Card className="rounded-2xl p-5 backdrop-blur-md bg-card/80 border-border/60 hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
          {icon}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold tabular-nums">{value}</span>
        {suffix && (
          <span className="text-xs font-semibold text-muted-foreground">{suffix}</span>
        )}
      </div>
    </Card>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0">
        <Filter className="w-3 h-3" />
        {label}
      </span>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "border-border/60 bg-card/60 text-foreground hover:bg-muted/60"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
