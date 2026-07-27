import { useAuth } from "@/contexts/AuthContext";
import type { Subscription, SubscriptionStatus } from "@/lib/subscriptionService";
import { daysUntilExpiry, formatExpiryDate } from "@/lib/subscriptionService";

export interface UseSubscriptionReturn {
  subscription: Subscription | null;
  status: SubscriptionStatus | "none";
  isSubscribed: boolean;
  isLoading: boolean;
  daysLeft: number | null;
  expiryLabel: string;
  refresh: () => Promise<void>;
}

/**
 * useSubscription — global subscription state for the authenticated user.
 *
 * Data flows through GET /api/subscriptions/status (JWT-authenticated server route
 * with service_role access), loaded automatically by AuthContext on login.
 *
 * Usage:
 *   const { status, isSubscribed, daysLeft, refresh } = useSubscription();
 */
export function useSubscription(): UseSubscriptionReturn {
  const {
    subscription,
    isSubscribed,
    isSubscriptionLoading,
    reloadSubscription,
  } = useAuth();

  return {
    subscription,
    status: subscription?.status ?? "none",
    isSubscribed,
    isLoading: isSubscriptionLoading,
    daysLeft: daysUntilExpiry(subscription?.expires_at ?? null),
    expiryLabel: formatExpiryDate(subscription?.expires_at ?? null),
    refresh: reloadSubscription,
  };
}
