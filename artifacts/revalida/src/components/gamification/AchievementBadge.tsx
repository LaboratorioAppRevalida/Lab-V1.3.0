/**
 * AchievementBadge — card visual de medalha/conquista.
 *
 * Reutiliza a identidade visual de TIER_META (gamificationStorage.ts):
 *   bronze | prata | ouro | platina
 *
 * Dois modos:
 *   - card:  exibição completa em grid (Conquistas, admin)
 *   - inline: badge compacto inline (Perfil, listagens)
 *
 * Substituirá o AchievementBadge local de Conquistas.tsx na FASE MEDALHAS 2.
 * Por ora coexiste sem alterar o comportamento atual.
 */

import { Award, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { TIER_META, type AchievementTier } from "@/lib/gamificationStorage";

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export type AchievementBadgeData = {
  id:          string;
  slug:        string;
  title:       string;
  description: string;
  tier:        AchievementTier;
  icon?:       string | null;
  color?:      string | null;
  /** Texto do requisito para exibição no estado bloqueado (ex: "30 dias seguidos") */
  requirementLabel?: string;
};

type Mode = "card" | "inline";

// ── Componente ─────────────────────────────────────────────────────────────────

/**
 * AchievementBadge em modo "card" (padrão).
 * Exibe gradiente, ícone, tier, título e descrição/requisito.
 */
export function AchievementBadge({
  achievement,
  unlocked,
  mode = "card",
  className,
}: {
  achievement: AchievementBadgeData;
  unlocked:    boolean;
  mode?:       Mode;
  className?:  string;
}) {
  if (mode === "inline") {
    return <AchievementBadgeInline achievement={achievement} unlocked={unlocked} className={className} />;
  }
  return <AchievementBadgeCard achievement={achievement} unlocked={unlocked} className={className} />;
}

// ── Card ───────────────────────────────────────────────────────────────────────

function AchievementBadgeCard({
  achievement,
  unlocked,
  className,
}: {
  achievement: AchievementBadgeData;
  unlocked:    boolean;
  className?:  string;
}) {
  const meta = TIER_META[achievement.tier];

  return (
    <Card
      className={cn(
        "rounded-2xl p-4 border-border/60 flex flex-col items-center text-center gap-2 transition-all",
        unlocked
          ? "bg-card/80 backdrop-blur-md hover:-translate-y-0.5"
          : "bg-muted/40 grayscale opacity-70",
        className,
      )}
    >
      <div
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ring-2",
          unlocked
            ? cn(meta.glow, meta.bg, meta.ring, "text-white")
            : "from-muted to-muted ring-border text-muted-foreground",
        )}
      >
        {achievement.icon
          ? (
            <span className="text-2xl leading-none select-none">
              {achievement.icon}
            </span>
          )
          : unlocked
            ? <Award className="w-7 h-7" />
            : <Lock  className="w-6 h-6" />
        }
      </div>

      <div className="space-y-0.5">
        <div
          className={cn(
            "text-[9px] uppercase tracking-wider font-extrabold",
            unlocked ? meta.text : "text-muted-foreground",
          )}
        >
          {meta.label}
        </div>
        <h3 className="text-xs font-bold leading-tight">{achievement.title}</h3>
        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
          {unlocked
            ? achievement.description
            : achievement.requirementLabel ?? achievement.description
          }
        </p>
      </div>
    </Card>
  );
}

// ── Inline ─────────────────────────────────────────────────────────────────────

function AchievementBadgeInline({
  achievement,
  unlocked,
  className,
}: {
  achievement: AchievementBadgeData;
  unlocked:    boolean;
  className?:  string;
}) {
  const meta = TIER_META[achievement.tier];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
        "text-[10px] font-bold ring-1 transition-all",
        unlocked
          ? cn(meta.ring, meta.text, "bg-background/80 backdrop-blur-sm")
          : "ring-border text-muted-foreground bg-muted/40 grayscale opacity-70",
        className,
      )}
      title={unlocked ? achievement.description : achievement.requirementLabel}
    >
      {achievement.icon
        ? <span className="leading-none select-none">{achievement.icon}</span>
        : unlocked
          ? <Award className="w-3 h-3" />
          : <Lock  className="w-3 h-3" />
      }
      {achievement.title}
    </span>
  );
}
