import { Clock, PauseCircle } from "lucide-react";
import { useTraining } from "@/contexts/TrainingContext";
import { useAlertPreference } from "@/hooks/useAlertPreference";

function fmt(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function StationTimer() {
  const { remainingSec, status, config, partnerDisconnected } = useTraining();
  const { alertsEnabled } = useAlertPreference();

  const total = (config?.tempoMin ?? 0) * 60;
  const pct = total > 0 ? Math.max(0, Math.min(100, (remainingSec / total) * 100)) : 0;

  const running = status === "running";
  const manualPaused = status === "paused_manual";
  const frozen = (partnerDisconnected && running) || manualPaused;

  // Visual urgency tiers — only active when running and not frozen
  const critical = running && !frozen && remainingSec <= 15;
  const urgent   = running && !frozen && remainingSec <= 30 && remainingSec > 15;
  const warning  = running && !frozen && remainingSec <= 60 && remainingSec > 30;

  // Last-minute indicator — respects user alert preference
  const lastMin = running && !frozen && alertsEnabled && remainingSec <= 60;

  // Icon container
  const iconBg = frozen
    ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
    : critical
    ? `bg-red-500/15 text-red-500 dark:text-red-400${alertsEnabled ? " animate-pulse" : ""}`
    : urgent
    ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
    : warning
    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
    : "bg-primary/10 text-primary";

  // Time digits
  const timeColor = frozen
    ? "text-blue-600 dark:text-blue-400"
    : critical
    ? "text-red-500 dark:text-red-400"
    : urgent
    ? "text-orange-600 dark:text-orange-400"
    : warning
    ? "text-amber-600 dark:text-amber-400"
    : "";

  // Progress bar fill
  const barColor = frozen
    ? "bg-blue-400"
    : critical
    ? "bg-red-500"
    : urgent
    ? "bg-orange-500"
    : warning
    ? "bg-amber-500"
    : "gradient-primary";

  // Card border accent
  const borderClass = frozen
    ? "border-blue-300/40"
    : critical
    ? "border-red-300/40"
    : urgent
    ? "border-orange-300/40"
    : warning
    ? "border-amber-300/40"
    : "border-border/60";

  // Sublabel below the clock digits
  const subLabel = manualPaused
    ? "Pausado"
    : frozen
    ? "Pausado"
    : status === "ended"
    ? "Encerrada"
    : critical && alertsEnabled
    ? "Encerrando"
    : lastMin
    ? "Último minuto"
    : "Restante";

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-xl backdrop-blur-md bg-card/70 border shadow-sm transition-colors ${borderClass}`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${iconBg}`}
      >
        {frozen ? (
          <PauseCircle className="w-4 h-4" />
        ) : (
          <Clock className="w-4 h-4" />
        )}
      </div>

      <div className="flex flex-col min-w-[64px]">
        <span
          className={`text-base font-bold tabular-nums leading-none transition-colors ${timeColor}`}
        >
          {fmt(Math.max(0, remainingSec))}
        </span>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-1">
          {subLabel}
        </span>
      </div>

      <div className="hidden sm:block w-24 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
