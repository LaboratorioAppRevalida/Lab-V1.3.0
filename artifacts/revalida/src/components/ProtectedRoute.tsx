import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

function SuspendedScreen({
  until,
  reason,
  onLogout,
}: {
  until: string | null;
  reason: string | null;
  onLogout: () => void;
}) {
  const untilDate = until ? new Date(until) : null;
  const formatted = untilDate
    ? untilDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background gap-6 p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <ShieldX className="w-8 h-8 text-destructive" />
      </div>
      <div className="flex flex-col gap-2 max-w-sm">
        <h1 className="text-xl font-bold text-foreground">Conta suspensa</h1>
        {reason && (
          <p className="text-sm text-muted-foreground">
            Motivo: <span className="text-foreground font-medium">{reason}</span>
          </p>
        )}
        {formatted ? (
          <p className="text-sm text-muted-foreground">
            Suspensão até <span className="text-foreground font-medium">{formatted}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Suspensão por prazo indeterminado.</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Em caso de dúvidas, entre em contato com a equipe Revalida.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onLogout}>
        Sair da conta
      </Button>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  // Verificação de suspensão — só bloqueia se a suspensão ainda estiver ativa
  if (profile?.is_suspended) {
    const until = profile.suspended_until;
    const isExpired = until ? new Date(until) < new Date() : false;
    if (!isExpired) {
      return (
        <SuspendedScreen
          until={until ?? null}
          reason={profile.suspension_reason ?? null}
          onLogout={logout}
        />
      );
    }
  }

  return <>{children}</>;
}
