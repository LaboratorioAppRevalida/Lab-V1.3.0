import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1", className)}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary shadow-md">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <span className="text-2xl font-bold tracking-tight text-gradient-primary">
          Revalida
        </span>
      </div>
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground ml-10">
        2ª Fase
      </span>
    </div>
  );
}
