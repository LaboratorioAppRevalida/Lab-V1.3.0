import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns expires_at ISO string based on plan_name stored in our DB. */
function calcExpiresAt(planName: string): string {
  const d = new Date();
  const n = (planName ?? "").toLowerCase();
  if (n.includes("anual"))      d.setFullYear(d.getFullYear() + 1);
  else if (n.includes("semestral")) d.setMonth(d.getMonth() + 6);
  else                          d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

/** Resolve user_id from a webhook payload object (payment or subscription). */
async function resolveUserId(
  externalRef: string | undefined | null,
  gatewayCustomerId: string | undefined | null
): Promise<string | null> {
  // 1. externalReference is always our user UUID
  if (externalRef && externalRef.length === 36) return externalRef;

  // 2. Fallback: look up by gateway_customer_id
  if (gatewayCustomerId) {
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id")
      .eq("gateway_customer_id", gatewayCustomerId)
      .maybeSingle();
    return data?.user_id ?? null;
  }
  return null;
}

// ── POST /webhooks/asaas ───────────────────────────────────────────────────

router.post("/webhooks/asaas", async (req, res) => {
  // Optional webhook token validation
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (expectedToken) {
    const received = req.headers["asaas-access-token"] as string | undefined;
    if (received !== expectedToken) {
      logger.warn("[asaas-webhook] Invalid token — request rejected");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const body = req.body as Record<string, unknown>;
  const event = body.event as string | undefined;

  logger.info({ event }, "[asaas-webhook] received event");

  try {
    // ── Payment events ───────────────────────────────────────────────────
    if (
      event === "PAYMENT_RECEIVED" ||
      event === "PAYMENT_CONFIRMED"
    ) {
      const payment = body.payment as Record<string, unknown> | undefined;
      if (!payment) { res.status(200).end(); return; }

      const userId = await resolveUserId(
        payment.externalReference as string,
        payment.customer as string
      );
      if (!userId) {
        logger.warn({ payment }, "[asaas-webhook] PAYMENT_RECEIVED: user not found");
        res.status(200).end();
        return;
      }

      // Retrieve current plan_name from DB for expiry calculation
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("plan_name")
        .eq("user_id", userId)
        .maybeSingle();

      const expiresAt    = calcExpiresAt(sub?.plan_name ?? "");
      const nextBilling  = expiresAt;

      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({
          status:           "ativo",
          expires_at:       expiresAt,
          next_billing_date: nextBilling,
          canceled_at:      null,
        })
        .eq("user_id", userId);

      if (error) logger.error({ error }, "[asaas-webhook] DB update failed (PAYMENT_RECEIVED)");
      else logger.info({ userId, expiresAt }, "[asaas-webhook] subscription activated");
    }

    // ── Payment overdue ──────────────────────────────────────────────────
    else if (event === "PAYMENT_OVERDUE") {
      const payment = body.payment as Record<string, unknown> | undefined;
      if (!payment) { res.status(200).end(); return; }

      const userId = await resolveUserId(
        payment.externalReference as string,
        payment.customer as string
      );
      if (!userId) { res.status(200).end(); return; }

      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "pendente" })
        .eq("user_id", userId);

      logger.info({ userId }, "[asaas-webhook] subscription set to pendente (PAYMENT_OVERDUE)");
    }

    // ── Payment deleted / refunded / chargeback ──────────────────────────
    else if (
      event === "PAYMENT_DELETED" ||
      event === "PAYMENT_REFUNDED" ||
      event === "PAYMENT_CHARGEBACK_DISPUTE" ||
      event === "PAYMENT_CHARGEBACK_REQUESTED"
    ) {
      const payment = body.payment as Record<string, unknown> | undefined;
      if (!payment) { res.status(200).end(); return; }

      const userId = await resolveUserId(
        payment.externalReference as string,
        payment.customer as string
      );
      if (!userId) { res.status(200).end(); return; }

      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "cancelado", canceled_at: new Date().toISOString() })
        .eq("user_id", userId);

      logger.info({ userId, event }, "[asaas-webhook] subscription canceled");
    }

    // ── Subscription created / activated ────────────────────────────────
    else if (
      event === "SUBSCRIPTION_CREATED" ||
      event === "SUBSCRIPTION_ACTIVATED"
    ) {
      const subscription = body.subscription as Record<string, unknown> | undefined;
      if (!subscription) { res.status(200).end(); return; }

      const userId = await resolveUserId(
        subscription.externalReference as string,
        subscription.customer as string
      );
      if (!userId) { res.status(200).end(); return; }

      const updates: Record<string, unknown> = {
        gateway_customer_id:     subscription.customer,
        gateway_subscription_id: subscription.id,
      };
      if (event === "SUBSCRIPTION_ACTIVATED") {
        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("plan_name")
          .eq("user_id", userId)
          .maybeSingle();
        updates.status     = "ativo";
        updates.expires_at = calcExpiresAt(sub?.plan_name ?? "");
        updates.next_billing_date = updates.expires_at;
      }

      await supabaseAdmin
        .from("subscriptions")
        .update(updates)
        .eq("user_id", userId);

      logger.info({ userId, event }, "[asaas-webhook] subscription ids stored");
    }

    // ── Subscription validation error ────────────────────────────────────
    else if (event === "SUBSCRIPTION_VALIDATION_ERROR") {
      const subscription = body.subscription as Record<string, unknown> | undefined;
      const payment      = body.payment      as Record<string, unknown> | undefined;
      const ref          = subscription ?? payment;
      if (!ref) { res.status(200).end(); return; }

      const userId = await resolveUserId(
        ref.externalReference as string,
        ref.customer as string
      );
      if (!userId) { res.status(200).end(); return; }

      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "pendente" })
        .eq("user_id", userId);

      logger.warn({ userId, event }, "[asaas-webhook] subscription validation error — set to pendente");
    }

    // ── Subscription inactivated / deleted ───────────────────────────────
    else if (
      event === "SUBSCRIPTION_INACTIVATED" ||
      event === "SUBSCRIPTION_DELETED"
    ) {
      const subscription = body.subscription as Record<string, unknown> | undefined;
      if (!subscription) { res.status(200).end(); return; }

      const userId = await resolveUserId(
        subscription.externalReference as string,
        subscription.customer as string
      );
      if (!userId) { res.status(200).end(); return; }

      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "cancelado", canceled_at: new Date().toISOString() })
        .eq("user_id", userId);

      logger.info({ userId, event }, "[asaas-webhook] subscription inactivated/deleted");
    }

    else {
      logger.info({ event }, "[asaas-webhook] unhandled event — ignoring");
    }
  } catch (err) {
    logger.error({ err, event }, "[asaas-webhook] unexpected error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  res.status(200).json({ received: true });
});

export default router;
