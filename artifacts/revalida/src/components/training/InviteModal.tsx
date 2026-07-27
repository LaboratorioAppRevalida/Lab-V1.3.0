import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTraining } from "@/contexts/TrainingContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Check, X } from "lucide-react";

const INVITE_TIMEOUT_SEC = 30;

export function InviteModal() {
  const { pendingInvite, acceptInvite, declineInvite, status } = useTraining();
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(INVITE_TIMEOUT_SEC);
  const timerRef = useRef<number | null>(null);

  // ── Countdown ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingInvite) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCountdown(INVITE_TIMEOUT_SEC);
      return;
    }

    setCountdown(INVITE_TIMEOUT_SEC);
    timerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          declineInvite();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInvite?.fromUserId]);

  // ── Navegação global quando status muda para role-select ─────────────────
  // Funciona tanto para quem recebeu o convite quanto para quem enviou.
  useEffect(() => {
    if (status === "role-select") {
      setLocation("/treino/roles");
    }
  }, [status, setLocation]);

  const progress = (countdown / INVITE_TIMEOUT_SEC) * 100;

  return (
    <Dialog open={!!pendingInvite} onOpenChange={(o) => !o && declineInvite()}>
      <DialogContent className="sm:max-w-sm backdrop-blur-xl bg-card/95 border-border/60">
        <DialogHeader>
          {/* Avatar animado */}
          <div className="mx-auto mb-3 relative">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center glow-primary">
              <Mail className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
            {/* Anel de ping */}
            <span className="absolute inset-0 rounded-2xl border-2 border-blue-400/50 animate-ping" />
          </div>

          <DialogTitle className="text-center text-xl leading-tight">
            {pendingInvite?.fromName} quer treinar com você
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground mt-1">
            Convite para uma estação prática ao vivo.
          </p>
        </DialogHeader>

        {/* Countdown */}
        <div className="mt-2">
          <div className="flex justify-between items-center text-xs text-muted-foreground mb-1.5">
            <span>Expira em</span>
            <span className={`font-bold tabular-nums ${countdown <= 10 ? "text-rose-500" : "text-foreground"}`}>
              {countdown}s
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full gradient-primary transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Button
            variant="outline"
            onClick={declineInvite}
            className="h-12 rounded-xl"
          >
            <X className="w-4 h-4 mr-2" /> Recusar
          </Button>
          <Button
            onClick={acceptInvite}
            className="h-12 rounded-xl gradient-primary text-white border-0 hover:opacity-95"
          >
            <Check className="w-4 h-4 mr-2" /> Aceitar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
