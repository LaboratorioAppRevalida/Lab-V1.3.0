import { Zap } from "lucide-react";
import { formatDatePt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function StreakPill({ className }: { className?: string }) {
  const { profile } = useAuth();
  const streak = profile?.streak_atual ?? 0;

  return (
    <div className={cn("flex items-center rounded-full bg-card border shadow-xs pl-1 pr-3 py-1 gap-2", className)}>
      <div className="flex h-6 w-6 items-center justify-center rounded-full gradient-primary text-white">
        <Zap className="h-3.5 w-3.5 fill-current" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-sm">{streak}</span>
        <span className="text-xs text-muted-foreground font-medium">
          {formatDatePt(new Date())}
        </span>
      </div>
    </div>
  );
}
