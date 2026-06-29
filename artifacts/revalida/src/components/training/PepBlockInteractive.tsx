import { motion } from "framer-motion";
import { Check, AlertTriangle, X, RotateCcw } from "lucide-react";
import type { PepBlock } from "@/lib/checklistStorage";
import type { PepResposta } from "@/contexts/TrainingContext";

const STYLE_BY_RESPOSTA: Record<
  PepResposta,
  { bg: string; border: string; ring: string; text: string; label: string }
> = {
  adequado: {
    bg: "bg-green-500/10 dark:bg-green-400/10",
    border: "border-green-400/40 dark:border-green-300/40",
    ring: "shadow-[0_0_30px_-8px_rgba(16,185,129,0.55)]",
    text: "text-emerald-700 dark:text-emerald-300",
    label: "Adequado",
  },
  parcial: {
    bg: "bg-yellow-400/10 dark:bg-amber-300/10",
    border: "border-yellow-300/40 dark:border-amber-300/40",
    ring: "shadow-[0_0_30px_-8px_rgba(234,179,8,0.55)]",
    text: "text-amber-700 dark:text-amber-300",
    label: "Parcialmente adequado",
  },
  inadequado: {
    bg: "bg-red-500/10 dark:bg-red-400/10",
    border: "border-red-400/40 dark:border-red-300/40",
    ring: "shadow-[0_0_30px_-8px_rgba(244,63,94,0.55)]",
    text: "text-red-700 dark:text-red-300",
    label: "Inadequado",
  },
};

type Props = {
  index: number;
  block: PepBlock;
  current?: PepResposta;
  onMark: (r: PepResposta) => void;
  onClear?: () => void;
  readOnly?: boolean;
};

export function PepBlockInteractive({ index, block, current, onMark, onClear, readOnly }: Props) {
  const style = current ? STYLE_BY_RESPOSTA[current] : null;

  const score =
    current === "adequado"
      ? block.scoreAdequado
      : current === "parcial"
        ? block.scoreParcial
        : current === "inadequado"
          ? 0
          : null;

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={`relative rounded-2xl border transition-all backdrop-blur-md ${
        style
          ? `${style.bg} ${style.border} ${style.ring}`
          : "bg-card/80 border-border/60 hover:border-border"
      } overflow-hidden`}
    >
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums ${
              style ? "bg-white/60 dark:bg-white/10 " + style.text : "bg-primary/10 text-primary"
            }`}
          >
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="flex-1 min-w-0">
            {block.titulo && (
              <h4 className={`font-semibold leading-snug ${style ? style.text : "text-foreground"}`}>
                {block.titulo}
              </h4>
            )}
            {block.texto && (
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                {block.texto}
              </p>
            )}
          </div>
          {score !== null && (
            <div className={`shrink-0 text-right ${style?.text}`}>
              <div className="text-lg font-bold tabular-nums leading-none">
                {score.toFixed(2)}
              </div>
              <div className="text-[10px] uppercase tracking-wider font-semibold mt-1">pts</div>
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="grid grid-cols-3 gap-2">
            <OptionButton
              icon={<Check className="w-4 h-4" />}
              label="Adequado"
              hint={block.scoreAdequado.toFixed(2)}
              variant="adequado"
              active={current === "adequado"}
              onClick={() => onMark("adequado")}
            />
            <OptionButton
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Parcial"
              hint={block.scoreParcial.toFixed(2)}
              variant="parcial"
              active={current === "parcial"}
              onClick={() => onMark("parcial")}
            />
            <OptionButton
              icon={<X className="w-4 h-4" />}
              label="Inadequado"
              hint="0.00"
              variant="inadequado"
              active={current === "inadequado"}
              onClick={() => onMark("inadequado")}
            />
          </div>
        )}

        {!readOnly && current && onClear && (
          <button
            onClick={onClear}
            className="self-start inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Desmarcar
          </button>
        )}
      </div>
    </motion.div>
  );
}

function OptionButton({
  icon,
  label,
  hint,
  variant,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  variant: PepResposta;
  active: boolean;
  onClick: () => void;
}) {
  const styles: Record<PepResposta, string> = {
    adequado: active
      ? "bg-emerald-500 text-white border-emerald-500 shadow-[0_8px_22px_-10px_rgba(16,185,129,0.7)]"
      : "border-emerald-300/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10",
    parcial: active
      ? "bg-amber-500 text-white border-amber-500 shadow-[0_8px_22px_-10px_rgba(245,158,11,0.7)]"
      : "border-amber-300/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10",
    inadequado: active
      ? "bg-rose-500 text-white border-rose-500 shadow-[0_8px_22px_-10px_rgba(244,63,94,0.7)]"
      : "border-rose-300/50 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10",
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl border-2 backdrop-blur-md transition-all text-[12px] font-semibold ${styles[variant]}`}
    >
      <span className="flex items-center gap-1.5">
        {icon}
        <span>{label}</span>
      </span>
      <span className={`text-[10px] tabular-nums font-bold opacity-80`}>{hint} pts</span>
    </button>
  );
}
