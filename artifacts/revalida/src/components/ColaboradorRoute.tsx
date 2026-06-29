import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

/**
 * Route guard that allows both 'admin' and 'colaborador' roles.
 * Admins retain full access to the colaborador portal (for testing/review).
 * Students are redirected to /inicio.
 */
export function ColaboradorRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isColaborador, isLoading } = useAuth();

  const hasAccess = isAdmin || isColaborador;

  useEffect(() => {
    if (!isLoading && user && !hasAccess) {
      toast.error("Acesso restrito a colaboradores");
    }
  }, [isLoading, user, hasAccess]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (!hasAccess) return <Redirect to="/inicio" />;

  return <>{children}</>;
}
