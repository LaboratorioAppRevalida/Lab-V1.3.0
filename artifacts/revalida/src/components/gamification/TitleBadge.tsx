/**
 * TitleBadge — badge estilo RPG/MMO para exibição de título equipado.
 *
 * Usado em: Dashboard, Rankings, PerfilPublico, Perfil, cards de usuário.
 * Recebe dados mínimos do título (Pick) para evitar over-fetching.
 */

import { cn } from "@/lib/utils";

export type TitleBadgeData = {
  name: string;
  rarity: string;
  color: string;
  icon?: string | null;
};

const RARITY_RING: Record<string, string> = {
  common:    "ring-slate-300/60   dark:ring-slate-600/60",
  rare:      "ring-blue-400/60",
  epic:      "ring-violet-500/60",
  legendary: "ring-amber-400/80",
  exclusive: "ring-pink-500/70",
  event:     "ring-emerald-400/70",
};

const RARITY_GLOW: Record<string, string> = {
  common:    "",
  rare:      "shadow-[0_0_10px_-3px_rgba(59,130,246,0.6)]",
  epic:      "shadow-[0_0_10px_-3px_rgba(139,92,246,0.7)]",
  legendary: "shadow-[0_0_14px_-3px_rgba(245,158,11,0.8)]",
  exclusive: "shadow-[0_0_12px_-3px_rgba(236,72,153,0.7)]",
  event:     "shadow-[0_0_10px_-3px_rgba(16,185,129,0.6)]",
};

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_CLS: Record<Size, string> = {
  xs: "px-1.5 py-0.5 text-[9px]  gap-1   ring-1",
  sm: "px-2   py-0.5 text-[10px] gap-1   ring-1",
  md: "px-2.5 py-1   text-xs     gap-1.5 ring-1",
  lg: "px-3   py-1.5 text-sm     gap-2   ring-2",
};

export function TitleBadge({
  title,
  size = "sm",
  className,
}: {
  title: TitleBadgeData;
  size?: Size;
  className?: string;
}) {
  const ring  = RARITY_RING[title.rarity]  ?? RARITY_RING.common;
  const glow  = RARITY_GLOW[title.rarity] ?? "";
  const szCls = SIZE_CLS[size];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold backdrop-blur-sm",
        "bg-background/80 border-transparent",
        ring, glow, szCls, className,
      )}
      style={{ color: title.color }}
    >
      {title.icon && (
        <span className="leading-none select-none">{title.icon}</span>
      )}
      {title.name}
    </span>
  );
}
