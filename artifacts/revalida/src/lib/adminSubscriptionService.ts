import { supabase } from "./supabase";
import type { SubscriptionStatus, PaymentMethod } from "./subscriptionService";

// ── Types ──────────────────────────────────────────────────────────────────

export interface UserWithSubscription {
  id: string;
  name: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  sub_id: string | null;
  plan_name: string | null;
  status: SubscriptionStatus | null;
  payment_method: PaymentMethod;
  payment_last4: string | null;
  expires_at: string | null;
}

export interface SubscriptionUpsert {
  plan_name: string;
  status: SubscriptionStatus;
  payment_method: PaymentMethod;
  payment_last4: string | null;
  expires_at: string | null;
}

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetches all profiles joined with their subscriptions (admin only).
 * Requires the caller to be an admin (enforced by Supabase RLS on profiles).
 */
export async function fetchUsersWithSubscriptions(): Promise<UserWithSubscription[]> {
  const [profilesRes, subsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, display_name, email, avatar_url")
      .order("name", { ascending: true }),
    supabase.from("subscriptions").select("*"),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const subsMap = new Map(
    ((subsRes.data ?? []) as {
      id: string;
      user_id: string;
      plan_name: string;
      status: string;
      payment_method: string | null;
      payment_last4: string | null;
      expires_at: string | null;
    }[]).map((s) => [s.user_id, s]),
  );

  return (profilesRes.data ?? []).map((p) => {
    const sub = subsMap.get(p.id) ?? null;
    return {
      id: p.id,
      name: p.name ?? "",
      display_name: p.display_name ?? null,
      email: p.email ?? "",
      avatar_url: p.avatar_url ?? null,
      sub_id: sub?.id ?? null,
      plan_name: sub?.plan_name ?? null,
      status: (sub?.status as SubscriptionStatus) ?? null,
      payment_method: (sub?.payment_method as PaymentMethod) ?? null,
      payment_last4: sub?.payment_last4 ?? null,
      expires_at: sub?.expires_at ?? null,
    };
  });
}

/**
 * Upserts a subscription for a given user_id.
 * Uses ON CONFLICT(user_id) to update if one already exists.
 */
export async function adminUpsertSubscription(
  userId: string,
  data: SubscriptionUpsert,
): Promise<void> {
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_name: data.plan_name,
      status: data.status,
      payment_method: data.payment_method || null,
      payment_last4:
        data.payment_method === "cartao" ? (data.payment_last4 || null) : null,
      expires_at: data.expires_at || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);
}

/**
 * Removes the subscription row entirely for a given user_id.
 */
export async function adminRemoveSubscription(userId: string): Promise<void> {
  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
