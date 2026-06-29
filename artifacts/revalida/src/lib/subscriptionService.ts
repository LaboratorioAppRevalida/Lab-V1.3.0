import { supabase } from "./supabase";

export type SubscriptionStatus = "ativo" | "pendente" | "expirado" | "cancelado";
export type PaymentMethod = "cartao" | "pix" | "boleto" | null;

export interface Subscription {
  id: string;
  user_id: string;
  plan_name: string;
  status: SubscriptionStatus;
  payment_method: PaymentMethod;
  payment_last4: string | null;
  expires_at: string | null;
  next_billing_date: string | null;
  gateway: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches the subscription via the secure API server route.
 * The API server validates the JWT server-side and queries with service_role,
 * bypassing RLS entirely — the canonical source of truth for subscription state.
 */
export async function fetchSubscriptionFromApi(
  accessToken: string
): Promise<Subscription | null> {
  const res = await fetch("/api/subscriptions/status", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) return null;

  if (!res.ok) {
    console.warn("[subscriptionService] API error:", res.status);
    return null;
  }

  const data = await res.json() as ({ status: "none" } | Subscription);
  if ((data as { status: string }).status === "none") return null;
  return data as Subscription;
}

/**
 * @deprecated Prefer fetchSubscriptionFromApi — queries Supabase directly
 * and may be blocked by RLS in some configurations.
 */
export async function fetchSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[subscriptionService] fetchSubscription error:", error.message);
    return null;
  }
  return data as Subscription | null;
}

export function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function formatExpiryDate(expiresAt: string | null): string {
  if (!expiresAt) return "—";
  return new Date(expiresAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
