import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  MessageSquare,
  BarChart3,
  RefreshCw,
  ChevronLeft,
  Wifi,
  WifiOff,
  Users,
  Zap,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type AppEvent = {
  id: string;
  user_id: string | null;
  event_type: string;
  stage: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type ErrorLog = {
  id: string;
  type: string;
  user_id: string | null;
  message: string;
  context: Record<string, unknown> | null;
  created_at: string;
};

type Feedback = {
  id: string;
  user_id: string | null;
  message: string;
  current_screen: string | null;
  created_at: string;
};

type Metrics = {
  sessionsStarted: number;
  sessionsCompleted: number;
  sessionsAbandoned: number;
  totalErrors: number;
  totalFeedback: number;
  uniqueUsersToday: number;
  uniqueUsersWeek: number;
  weeklyEvents: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function weekAgoISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function eventBadgeColor(type: string): string {
  switch (type) {
    case "session_started": return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
    case "session_completed": return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "session_abandoned": return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "session_flow_error": return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
    default: return "bg-muted text-muted-foreground";
  }
}

function eventLabel(type: string): string {
  const map: Record<string, string> = {
    session_started: "Início",
    session_completed: "Concluída",
    session_abandoned: "Abandono",
    session_flow_error: "Falha",
    login: "Login",
    register: "Cadastro",
    feedback_submitted: "Feedback",
  };
  return map[type] ?? type;
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function Observabilidade() {
  const [, setLocation] = useLocation();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    sessionsStarted: 0,
    sessionsCompleted: 0,
    sessionsAbandoned: 0,
    totalErrors: 0,
    totalFeedback: 0,
    uniqueUsersToday: 0,
    uniqueUsersWeek: 0,
    weeklyEvents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadData = async () => {
    const today = todayISO() + "T00:00:00.000Z";
    const weekAgo = weekAgoISO();

    const [eventsRes, errorsRes, feedbackRes] = await Promise.all([
      supabase.from("app_events").select("*").order("created_at", { ascending: false }).limit(60),
      supabase.from("app_error_logs").select("*").order("created_at", { ascending: false }).limit(60),
      supabase.from("user_feedback").select("*").order("created_at", { ascending: false }).limit(60),
    ]);

    const evData = (eventsRes.data ?? []) as AppEvent[];
    const erData = (errorsRes.data ?? []) as ErrorLog[];
    const fbData = (feedbackRes.data ?? []) as Feedback[];

    setEvents(evData);
    setErrors(erData);
    setFeedbacks(fbData);

    // Métricas calculadas client-side a partir dos dados já carregados
    const todayEvents = evData.filter((e) => e.created_at >= today);
    const weekEvents = evData.filter((e) => e.created_at >= weekAgo);
    const todayErrors = erData.filter((e) => e.created_at >= today);
    const todayFeedback = fbData.filter((f) => f.created_at >= today);

    const uniqueToday = new Set(
      todayEvents.filter((e) => e.user_id).map((e) => e.user_id),
    ).size;
    const uniqueWeek = new Set(
      weekEvents.filter((e) => e.user_id).map((e) => e.user_id),
    ).size;

    setMetrics({
      sessionsStarted: todayEvents.filter((e) => e.event_type === "session_started").length,
      sessionsCompleted: todayEvents.filter((e) => e.event_type === "session_completed").length,
      sessionsAbandoned: todayEvents.filter((e) => e.event_type === "session_abandoned").length,
      totalErrors: todayErrors.length,
      totalFeedback: todayFeedback.length,
      uniqueUsersToday: uniqueToday,
      uniqueUsersWeek: uniqueWeek,
      weeklyEvents: weekEvents.filter((e) => e.event_type === "session_completed").length,
    });

    setLastRefresh(new Date());
    setLoading(false);
  };

  // Polling a cada 15s como fallback
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15_000);
    return () => clearInterval(interval);
  }, []);

  // Supabase Realtime (funciona se as tabelas estão na publication supabase_realtime)
  useEffect(() => {
    const ch = supabase
      .channel("observabilidade-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "app_events" }, () => loadData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "app_error_logs" }, () => loadData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_feedback" }, () => loadData())
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });

    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const totalToday = metrics.sessionsStarted;
  const completionRate = totalToday > 0
    ? Math.round((metrics.sessionsCompleted / totalToday) * 100)
    : 0;
  const abandonRate = totalToday > 0
    ? Math.round((metrics.sessionsAbandoned / totalToday) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-1 pt-2 pb-1"
      >
        <button
          onClick={() => setLocation("/admin")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" /> Admin
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Observabilidade</h1>
            <p className="text-muted-foreground mt-1 font-medium">
              Monitoramento em tempo real da plataforma
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              isLive
                ? "text-emerald-600 dark:text-emerald-400 border-emerald-400/30 bg-emerald-500/10"
                : "text-muted-foreground border-border/50"
            }`}>
              {isLive ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isLive ? "ao vivo" : "polling"}
            </div>
            <Button variant="outline" size="sm" onClick={loadData} className="h-8 gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </Button>
          </div>
        </div>

        {lastRefresh && (
          <p className="text-xs text-muted-foreground mt-2">
            Atualizado às {lastRefresh.toLocaleTimeString("pt-BR")}
          </p>
        )}
      </motion.div>

      {/* Bloco 4 — Métricas rápidas */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            Métricas de hoje
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Sessões iniciadas",
              value: metrics.sessionsStarted,
              icon: Zap,
              color: "text-blue-500",
              bg: "bg-blue-500/10",
            },
            {
              label: "Concluídas",
              value: metrics.sessionsCompleted,
              icon: CheckCircle2,
              color: "text-emerald-500",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Abandonadas",
              value: metrics.sessionsAbandoned,
              icon: XCircle,
              color: "text-amber-500",
              bg: "bg-amber-500/10",
            },
            {
              label: "Taxa de conclusão",
              value: `${completionRate}%`,
              icon: BarChart3,
              color: "text-violet-500",
              bg: "bg-violet-500/10",
            },
            {
              label: "Taxa de abandono",
              value: `${abandonRate}%`,
              icon: XCircle,
              color: "text-rose-500",
              bg: "bg-rose-500/10",
            },
            {
              label: "Sess. semanais concluídas",
              value: metrics.weeklyEvents,
              icon: Activity,
              color: "text-cyan-500",
              bg: "bg-cyan-500/10",
            },
            {
              label: "Usuários únicos hoje",
              value: metrics.uniqueUsersToday,
              icon: Users,
              color: "text-fuchsia-500",
              bg: "bg-fuchsia-500/10",
            },
            {
              label: "Usuários únicos (7 dias)",
              value: metrics.uniqueUsersWeek,
              icon: Users,
              color: "text-indigo-500",
              bg: "bg-indigo-500/10",
            },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <Card key={m.label} className="p-4 border-border/50">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${m.bg}`}>
                  <Icon className={`w-4 h-4 ${m.color}`} />
                </div>
                <div className={`text-2xl font-extrabold tabular-nums ${m.color}`}>
                  {loading ? "—" : m.value}
                </div>
                <div className="text-xs text-muted-foreground font-medium mt-0.5">{m.label}</div>
              </Card>
            );
          })}
        </div>
      </motion.section>

      {/* Grid de Bloco 1 + Bloco 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bloco 1 — Eventos em tempo real */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Eventos recentes
            </h2>
            <Badge variant="secondary" className="text-[10px]">{events.length}</Badge>
          </div>

          <Card className="border-border/50 divide-y divide-border/40 max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
            ) : events.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhum evento registrado ainda.
              </div>
            ) : (
              events.map((e) => (
                <div key={e.id} className="px-4 py-2.5 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                  <div className="shrink-0 mt-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${eventBadgeColor(e.event_type)}`}>
                      {eventLabel(e.event_type)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground truncate">
                      {e.stage && <span className="font-medium">{e.stage} · </span>}
                      {e.user_id ? e.user_id.slice(0, 8) + "…" : "anônimo"}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                    {formatTime(e.created_at)}
                  </div>
                </div>
              ))
            )}
          </Card>
        </motion.section>

        {/* Bloco 2 — Logs de erro */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Logs de erro
            </h2>
            <Badge variant="secondary" className="text-[10px]">{errors.length}</Badge>
          </div>

          <Card className="border-border/50 divide-y divide-border/40 max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
            ) : errors.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhum erro registrado. 
              </div>
            ) : (
              errors.map((e) => (
                <div key={e.id} className="px-4 py-2.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                      {e.type}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">
                      {formatDate(e.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/80 truncate">{e.message}</p>
                  {e.user_id && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      uid: {e.user_id.slice(0, 8)}…
                    </p>
                  )}
                </div>
              ))
            )}
          </Card>
        </motion.section>
      </div>

      {/* Bloco 3 — Feedback dos usuários */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            Feedback dos usuários
          </h2>
          <Badge variant="secondary" className="text-[10px]">{feedbacks.length}</Badge>
        </div>

        <Card className="border-border/50 divide-y divide-border/40">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : feedbacks.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum feedback recebido ainda.
            </div>
          ) : (
            feedbacks.map((f) => (
              <div key={f.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    {f.current_screen && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {f.current_screen}
                      </span>
                    )}
                    {f.user_id && (
                      <span className="text-[10px] text-muted-foreground">
                        uid: {f.user_id.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {formatDate(f.created_at)}
                  </span>
                </div>
                <p className="text-sm text-foreground/90">{f.message}</p>
              </div>
            ))
          )}
        </Card>
      </motion.section>
    </div>
  );
}
