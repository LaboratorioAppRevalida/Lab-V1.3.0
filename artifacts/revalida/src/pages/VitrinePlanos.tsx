import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, MessageCircle, Gem, Zap, Star, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

// ─── Plan data ─────────────────────────────────────────────────────────────
interface Plan {
  id: string;
  name: string;
  badge?: string;
  badgeTone: "primary" | "amber" | "violet" | "none";
  priceLabel: string | null;
  priceNote: string | null;
  totalLabel: string | null;
  discount: string | null;
  cta: string;
  ctaVariant: "primary" | "outline" | "consult";
  features: string[];
  icon: typeof Gem;
  highlight: boolean;
}

const PLANS: Plan[] = [
  {
    id: "mensal",
    name: "Mensal",
    badgeTone: "none",
    priceLabel: "R$ 189,90",
    priceNote: "/ mês",
    totalLabel: null,
    discount: null,
    cta: "Começar agora",
    ctaVariant: "outline",
    icon: Zap,
    highlight: false,
    features: [
      "Acesso completo à plataforma",
      "Histórico de sessões ilimitado",
      "Ranqueamento e medalhas",
      "Suporte por chat",
    ],
  },
  {
    id: "semestral",
    name: "Semestral",
    badge: "5% OFF",
    badgeTone: "violet",
    priceLabel: "R$ 180,40",
    priceNote: "/ mês",
    totalLabel: "Total: R$ 1.082,43",
    discount: "Economia de R$ 57,07",
    cta: "Assinar semestral",
    ctaVariant: "outline",
    icon: Star,
    highlight: false,
    features: [
      "Tudo do plano Mensal",
      "5 % de desconto aplicado",
      "Acesso garantido por 6 meses",
      "Prioridade no suporte",
    ],
  },
  {
    id: "anual",
    name: "Anual",
    badge: "MAIS VENDIDO",
    badgeTone: "amber",
    priceLabel: "R$ 170,91",
    priceNote: "/ mês",
    totalLabel: "Total: R$ 2.050,92",
    discount: "Economia de R$ 227,88",
    cta: "Assinar anual",
    ctaVariant: "primary",
    icon: Trophy,
    highlight: true,
    features: [
      "Tudo do plano Semestral",
      "10 % de desconto aplicado",
      "Acesso garantido por 12 meses",
      "Certificado de conclusão",
      "Suporte prioritário 24 h",
    ],
  },
  {
    id: "passaporte",
    name: "Passaporte",
    badge: "CONSULTORIA",
    badgeTone: "primary",
    priceLabel: null,
    priceNote: null,
    totalLabel: null,
    discount: null,
    cta: "Falar com Consultor",
    ctaVariant: "consult",
    icon: Gem,
    highlight: false,
    features: [
      "Acesso vitalício à plataforma",
      "Mentoria individualizada",
      "Simulados presenciais exclusivos",
      "Consultoria de carreira médica",
      "Acesso a conteúdos inéditos",
    ],
  },
];

// ─── Badge colours keyed on tone ──────────────────────────────────────────
const BADGE_TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary border border-primary/30",
  amber:   "bg-amber-500/15 text-amber-500 border border-amber-500/30",
  violet:  "bg-violet-500/15 text-violet-400 border border-violet-500/30",
  none:    "",
};

// ─── Floating blob positions ───────────────────────────────────────────────
const BLOBS = [
  { w: 520, h: 520, x: "10%",  y: "-8%",  color: "from-primary/25 via-primary/10 to-transparent",        delay: 0   },
  { w: 480, h: 480, x: "55%",  y: "30%",  color: "from-violet-500/20 via-violet-500/8 to-transparent",   delay: 1.5 },
  { w: 400, h: 400, x: "-5%",  y: "55%",  color: "from-amber-500/18 via-amber-500/6 to-transparent",     delay: 3   },
];

const blobVariants = (delay: number) => ({
  animate: {
    y: [0, -22, 0],
    transition: { duration: 8, repeat: Infinity, ease: "easeInOut" as const, delay },
  },
});

// ─── Component ─────────────────────────────────────────────────────────────
export default function VitrinePlanos() {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  const activePlanId =
    subscription?.status === "ativo"
      ? subscription.plan_name.toLowerCase()
      : null;

  const handleCheckout = async (planId: string) => {
    if (planId === "passaporte") {
      const url =
        (import.meta.env.VITE_WHATSAPP_CONSULTORIA as string | undefined) ??
        "https://wa.me/5500000000000";
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!user?.id || !user?.email) {
      toast.error("Faça login para continuar.");
      return;
    }
    setCheckingOut(planId);
    try {
      const res = await fetch("/api/checkout/asaas", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          userId:    user.id,
          userEmail: user.email,
          userName:  user.name ?? user.email,
        }),
      });

      // Safely parse response — guard against HTML error pages from the proxy
      const raw = await res.text();
      let data: { checkoutUrl?: string; error?: string };
      try {
        data = JSON.parse(raw) as { checkoutUrl?: string; error?: string };
      } catch {
        console.error("[checkout] resposta não-JSON do servidor:", raw.slice(0, 200));
        throw new Error("O servidor retornou uma resposta inesperada. Tente novamente em instantes.");
      }

      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Não foi possível gerar o link de pagamento.");
      }
      window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar checkout.");
    } finally {
      setCheckingOut(null);
    }
  };

  return (
    <div className="relative flex flex-col gap-10 pb-10 min-h-[60vh]">

      {/* ── Background blobs ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        {BLOBS.map((b, i) => (
          <motion.div
            key={i}
            className={cn("absolute rounded-full bg-radial-[at_50%_50%] blur-3xl opacity-70", b.color)}
            style={{ width: b.w, height: b.h, left: b.x, top: b.y }}
            variants={blobVariants(b.delay)}
            animate="animate"
          />
        ))}
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-1 pt-2 text-center"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/8 text-primary text-xs font-semibold uppercase tracking-widest mb-3">
          <Gem className="w-3.5 h-3.5" />
          Planos & Assinaturas
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
          Escolha seu plano
        </h1>
        <p className="text-muted-foreground mt-2 text-base font-medium max-w-lg mx-auto">
          Invista na sua aprovação. Quanto mais tempo, maior o desconto.
        </p>

        {/* Active plan notice banner */}
        {activePlanId && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Você tem um plano ativo — confira seu card destacado abaixo
          </motion.div>
        )}
      </motion.div>

      {/* ── Cards grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 px-1">
        {PLANS.map((plan, i) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            index={i}
            isActive={activePlanId === plan.id}
            onCheckout={handleCheckout}
            isCheckingOut={checkingOut === plan.id}
          />
        ))}
      </div>

      {/* ── Footer note ──────────────────────────────────────────────────── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center text-xs text-muted-foreground px-4"
      >
        Todos os planos incluem acesso imediato após confirmação do pagamento.
        Cancele a qualquer momento nos planos mensais.
      </motion.p>
    </div>
  );
}

// ─── Plan card ─────────────────────────────────────────────────────────────
function PlanCard({
  plan,
  index,
  isActive,
  onCheckout,
  isCheckingOut,
}: {
  plan: Plan;
  index: number;
  isActive: boolean;
  onCheckout: (planId: string) => void;
  isCheckingOut: boolean;
}) {
  const Icon = plan.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      whileHover={isActive ? {} : { y: -8, scale: 1.05 }}
      className={cn(
        "relative flex flex-col rounded-3xl border p-6",
        "backdrop-blur-lg shadow-2xl transition-shadow duration-300",
        isActive
          ? [
              "bg-gradient-to-b from-emerald-500/15 via-card/60 to-card/40",
              "border-emerald-500/50 shadow-[0_0_40px_-8px_rgba(16,185,129,0.25)]",
              "cursor-default",
            ]
          : plan.highlight
            ? [
                "bg-gradient-to-b from-primary/20 via-card/60 to-card/40",
                "border-primary/40 shadow-[0_0_40px_-8px_var(--primary-color,hsl(var(--primary)/30%))]",
                "cursor-pointer",
              ]
            : "bg-card/40 border-border/30 hover:border-primary/25 cursor-pointer",
      )}
    >
      {/* Active glow ring */}
      {isActive && (
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-emerald-500/30" />
      )}

      {/* Highlight glow ring (Anual) */}
      {plan.highlight && !isActive && (
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-primary/20" />
      )}

      {/* Badge row — "Plano Ativo" overrides the plan's own badge */}
      <div className="mb-4">
        {isActive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <CheckCircle2 className="w-3 h-3" />
            Plano Ativo
          </span>
        ) : plan.badge ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest",
              BADGE_TONE[plan.badgeTone],
            )}
          >
            {plan.badge}
          </span>
        ) : (
          <div className="h-[22px]" />
        )}
      </div>

      {/* Icon + name */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
            isActive
              ? "bg-emerald-500/20 text-emerald-400"
              : plan.highlight
                ? "bg-primary/20 text-primary"
                : "bg-muted/60 text-muted-foreground",
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-bold tracking-tight">{plan.name}</h2>
      </div>

      {/* Pricing block */}
      <div className="mb-6 min-h-[80px]">
        {plan.priceLabel ? (
          <>
            <div className="flex items-end gap-1.5 leading-none">
              <span className="text-4xl font-extrabold tabular-nums tracking-tight text-foreground">
                {plan.priceLabel}
              </span>
              {plan.priceNote && (
                <span className="text-sm text-muted-foreground font-medium pb-0.5">
                  {plan.priceNote}
                </span>
              )}
            </div>
            {plan.totalLabel && (
              <p className="text-xs text-muted-foreground mt-1.5">{plan.totalLabel}</p>
            )}
            {plan.discount && (
              <p className="text-xs font-semibold text-emerald-500 mt-0.5">
                {plan.discount}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-1 mt-1">
            <span className="text-2xl font-extrabold text-foreground">Sob consulta</span>
            <p className="text-xs text-muted-foreground">Entre em contato para condições especiais</p>
          </div>
        )}
      </div>

      {/* Features list */}
      <ul className="flex flex-col gap-2.5 mb-8 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckCircle2
              className={cn(
                "w-4 h-4 shrink-0 mt-0.5",
                isActive
                  ? "text-emerald-400"
                  : plan.highlight
                    ? "text-primary"
                    : "text-emerald-500",
              )}
            />
            <span className="text-sm text-muted-foreground leading-snug">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <CtaButton plan={plan} isActive={isActive} onCheckout={() => onCheckout(plan.id)} isLoading={isCheckingOut} />
    </motion.div>
  );
}

// ─── CTA button ────────────────────────────────────────────────────────────
function CtaButton({
  plan,
  isActive,
  onCheckout,
  isLoading,
}: {
  plan: Plan;
  isActive: boolean;
  onCheckout: () => void;
  isLoading: boolean;
}) {
  if (isActive) {
    return (
      <div className="w-full h-11 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold text-sm inline-flex items-center justify-center gap-2 select-none">
        <CheckCircle2 className="w-4 h-4" />
        Seu Plano Atual
      </div>
    );
  }

  if (plan.ctaVariant === "primary") {
    return (
      <button
        onClick={onCheckout}
        disabled={isLoading}
        className="w-full h-11 rounded-2xl gradient-primary text-white font-bold text-sm border-0 glow-primary transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {isLoading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando…</>
          : plan.cta}
      </button>
    );
  }

  if (plan.ctaVariant === "consult") {
    return (
      <button
        onClick={onCheckout}
        className="w-full h-11 rounded-2xl border border-primary/40 text-primary font-bold text-sm bg-primary/8 hover:bg-primary/15 transition-colors inline-flex items-center justify-center gap-2 active:scale-95"
      >
        <MessageCircle className="w-4 h-4" />
        {plan.cta}
      </button>
    );
  }

  return (
    <button
      onClick={onCheckout}
      disabled={isLoading}
      className="w-full h-11 rounded-2xl border border-border/50 text-foreground font-bold text-sm bg-card/60 hover:border-primary/40 hover:bg-primary/8 transition-colors active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
    >
      {isLoading
        ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando…</>
        : plan.cta}
    </button>
  );
}
