import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ArrowRight,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// ── Types ───────────────────────────────────────────────────────────────────
type PageState = "aguardando" | "ativo" | "timeout";

// ── Constants ──────────────────────────────────────────────────────────────
const TIMEOUT_MS = 90_000;
const WHATSAPP_URL =
  (import.meta.env.VITE_WHATSAPP_CONSULTORIA as string | undefined) ??
  "https://wa.me/5500000000000";

// ── Floating particles for success state ──────────────────────────────────
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: Math.sin((i / 12) * Math.PI * 2) * 140,
  y: Math.cos((i / 12) * Math.PI * 2) * 140,
  delay: i * 0.05,
  size: i % 3 === 0 ? 8 : i % 3 === 1 ? 5 : 4,
}));

// ── Background blobs ──────────────────────────────────────────────────────
const BLOBS = [
  { w: 500, h: 500, x: "5%",  y: "-10%", color: "from-primary/20 via-primary/8 to-transparent",      delay: 0   },
  { w: 420, h: 420, x: "60%", y: "40%",  color: "from-violet-500/18 via-violet-500/6 to-transparent", delay: 1.8 },
  { w: 350, h: 350, x: "-5%", y: "60%",  color: "from-emerald-500/15 via-emerald-500/5 to-transparent", delay: 3.2 },
];

// ── Component ───────────────────────────────────────────────────────────────
export default function AssinaturaConfirmada() {
  const { user, subscription, isSubscribed, reloadSubscription } = useAuth();
  const [, navigate] = useLocation();
  const [pageState, setPageState] = useState<PageState>(
    isSubscribed ? "ativo" : "aguardando"
  );
  const [elapsed, setElapsed] = useState(0);

  const channelRef  = useRef<RealtimeChannel | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Mark success and clean up timers ─────────────────────────────────────
  const handleActivation = () => {
    if (timeoutRef.current)  clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (channelRef.current)  void supabase.removeChannel(channelRef.current);
    void reloadSubscription();
    setPageState("ativo");
  };

  // ── Main effect: Realtime subscription + timeout ─────────────────────────
  useEffect(() => {
    if (isSubscribed) { setPageState("ativo"); return; }
    if (!user?.id) return;

    // Elapsed counter for progress feedback
    intervalRef.current = setInterval(
      () => setElapsed((s) => s + 1),
      1_000
    );

    // Realtime listener
    const ch = supabase
      .channel(`assinatura-confirmada-${user.id}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "subscriptions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const incoming = payload.new as { status?: string };
          if (incoming.status === "ativo") handleActivation();
        }
      )
      .subscribe();

    channelRef.current = ch;

    // Timeout fallback
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPageState("timeout");
    }, TIMEOUT_MS);

    return () => {
      if (timeoutRef.current)  clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (channelRef.current)  void supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isSubscribed]);

  const firstName = user?.name?.split(" ")[0] ?? "Médico";
  const planLabel = subscription?.plan_name
    ? `Plano ${subscription.plan_name}`
    : "Plano ativado";

  return (
    <div className="relative min-h-[70vh] flex flex-col items-center justify-center py-10 px-4 overflow-hidden">

      {/* ── Background blobs ───────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {BLOBS.map((b, i) => (
          <motion.div
            key={i}
            className={cn(
              "absolute rounded-full bg-radial-[at_50%_50%] blur-3xl opacity-60",
              b.color
            )}
            style={{ width: b.w, height: b.h, left: b.x, top: b.y }}
            animate={{ y: [0, -18, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: b.delay }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── AGUARDANDO ─────────────────────────────────────────────── */}
        {pageState === "aguardando" && (
          <motion.div
            key="aguardando"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-8 w-full max-w-md"
          >
            {/* Pulsing ring */}
            <div className="relative flex items-center justify-center">
              {[0, 1, 2].map((ring) => (
                <motion.div
                  key={ring}
                  className="absolute rounded-full border border-primary/40"
                  style={{ width: 80 + ring * 48, height: 80 + ring * 48 }}
                  animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.15, 0.6] }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: ring * 0.35,
                  }}
                />
              ))}
              <div className="relative z-10 w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_32px_-4px_hsl(var(--primary)/0.4)]">
                <Zap className="w-9 h-9 text-primary" />
              </div>
            </div>

            {/* Glass card */}
            <div className="w-full rounded-3xl border border-border/40 bg-card/50 backdrop-blur-xl shadow-2xl p-8 flex flex-col items-center gap-5 text-center">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">
                  Processando sua assinatura
                </h1>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Estamos confirmando seu pagamento com segurança via Asaas.
                  Isso costuma levar apenas alguns instantes.
                </p>
              </div>

              {/* Animated dots */}
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((dot) => (
                  <motion.div
                    key={dot}
                    className="w-2 h-2 rounded-full bg-primary"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: dot * 0.25,
                    }}
                  />
                ))}
              </div>

              {/* Elapsed time feedback */}
              <AnimatePresence>
                {elapsed > 15 && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="text-xs text-muted-foreground"
                  >
                    Aguardando confirmação do banco… ({elapsed}s)
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Status bar */}
              <div className="w-full h-1 rounded-full bg-border/30 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ATIVO ──────────────────────────────────────────────────── */}
        {pageState === "ativo" && (
          <motion.div
            key="ativo"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 180, damping: 18 }}
            className="flex flex-col items-center gap-8 w-full max-w-md"
          >
            {/* Success icon with particles */}
            <div className="relative flex items-center justify-center">
              {PARTICLES.map((p) => (
                <motion.div
                  key={p.id}
                  className="absolute rounded-full bg-emerald-400"
                  style={{ width: p.size, height: p.size }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{
                    x: p.x,
                    y: p.y,
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                  }}
                  transition={{
                    duration: 1.2,
                    delay: 0.2 + p.delay,
                    ease: "easeOut",
                  }}
                />
              ))}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.1 }}
                className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center shadow-[0_0_48px_-6px_rgba(16,185,129,0.5)]"
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              </motion.div>
            </div>

            {/* Welcome card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.45 }}
              className="w-full rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/10 via-card/60 to-card/40 backdrop-blur-xl shadow-2xl p-8 flex flex-col items-center gap-6 text-center"
            >
              {/* Plan badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/35 bg-emerald-500/12 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                {planLabel}
              </div>

              <div>
                <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
                  Bem-vindo, {firstName}! 🎉
                </h1>
                <p className="text-muted-foreground mt-3 text-base leading-relaxed max-w-sm">
                  Sua assinatura está ativa. Agora você tem acesso completo às
                  <span className="text-foreground font-semibold"> Estações Práticas</span> e
                  todos os módulos do EliteMed.
                </p>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full mt-1">
                <button
                  onClick={() => navigate("/treino")}
                  className="flex-1 h-12 rounded-2xl gradient-primary text-white font-bold text-sm border-0 glow-primary transition-transform active:scale-95 inline-flex items-center justify-center gap-2"
                >
                  Ir para o Treino
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="flex-1 h-12 rounded-2xl border border-border/50 text-foreground font-semibold text-sm bg-card/60 hover:border-primary/40 hover:bg-primary/8 transition-colors active:scale-95"
                >
                  Ver Dashboard
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Seu acesso foi ativado instantaneamente. Bons estudos!
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* ── TIMEOUT ────────────────────────────────────────────────── */}
        {pageState === "timeout" && (
          <motion.div
            key="timeout"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-8 w-full max-w-md"
          >
            {/* Warning icon */}
            <div className="w-20 h-20 rounded-full bg-amber-500/15 border border-amber-500/35 flex items-center justify-center shadow-[0_0_32px_-8px_rgba(245,158,11,0.4)]">
              <AlertTriangle className="w-10 h-10 text-amber-400" />
            </div>

            {/* Card */}
            <div className="w-full rounded-3xl border border-amber-500/20 bg-gradient-to-b from-amber-500/8 via-card/60 to-card/40 backdrop-blur-xl shadow-2xl p-8 flex flex-col items-center gap-6 text-center">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">
                  Isso está demorando mais que o esperado
                </h1>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  Em pagamentos com cartão de crédito, a análise do banco pode
                  levar alguns minutos extras. Assim que aprovado, seu acesso é
                  liberado automaticamente.
                </p>
              </div>

              <div className="w-full rounded-2xl border border-border/30 bg-card/50 p-4 flex flex-col gap-1.5 text-left text-xs text-muted-foreground">
                <p className="font-semibold text-foreground text-sm">O que fazer agora?</p>
                <p>• Clique em <strong>Atualizar página</strong> — pode ser que o pagamento já foi aprovado</p>
                <p>• Se o problema persistir, entre em contato com o nosso suporte</p>
                <p>• Pagamentos via Pix são aprovados em segundos</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 h-11 rounded-2xl gradient-primary text-white font-bold text-sm border-0 glow-primary transition-transform active:scale-95 inline-flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Atualizar página
                </button>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-11 rounded-2xl border border-border/50 text-foreground font-semibold text-sm bg-card/60 hover:border-primary/40 hover:bg-primary/8 transition-colors active:scale-95 inline-flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Falar com Suporte
                </a>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
