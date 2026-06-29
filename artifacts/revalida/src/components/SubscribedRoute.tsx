import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * SubscribedRoute — wraps routes that require an active subscription.
 *
 * Resolution order:
 *  1. Auth + subscription still loading → spinner
 *  2. Not authenticated              → redirect to /login
 *  3. Authenticated but not subscribed → redirect to /assinatura
 *  4. Subscribed (or admin/colaborador) → render children
 */
export function SubscribedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isSubscriptionLoading, isAuthenticated, isSubscribed } = useAuth();

  if (isLoading || isSubscriptionLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (!isSubscribed) {
    return <Redirect to="/assinatura" />;
  }

  return <>{children}</>;
}
