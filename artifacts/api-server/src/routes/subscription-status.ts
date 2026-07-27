import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── GET /subscriptions/status ─────────────────────────────────────────────
//
// Requires:  Authorization: Bearer <supabase-access-token>
// Returns:   { status, plan_name, expires_at, next_billing_date, gateway }
//            or { status: "none" } when no subscription row exists yet.

router.get("/subscriptions/status", async (req, res) => {
  // 1. Extract Bearer token ─────────────────────────────────────────────────
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  // 2. Verify token & resolve user via Supabase Auth ────────────────────────
  const { data: userData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !userData?.user) {
    logger.warn({ authError }, "[subscription-status] invalid or expired token");
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const userId = userData.user.id;

  // 3. Query subscriptions table ────────────────────────────────────────────
  const { data: sub, error: dbError } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, status, plan_name, expires_at, next_billing_date, gateway, " +
      "canceled_at, payment_method, payment_last4, created_at, updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (dbError) {
    logger.error({ dbError, userId }, "[subscription-status] DB query failed");
    res.status(500).json({ error: "Failed to fetch subscription" });
    return;
  }

  if (!sub) {
    res.json({ status: "none" });
    return;
  }

  logger.info({ userId, status: sub.status }, "[subscription-status] returned");

  res.json({
    id:                sub.id,
    user_id:           userId,
    status:            sub.status,
    plan_name:         sub.plan_name,
    expires_at:        sub.expires_at        ?? null,
    next_billing_date: sub.next_billing_date ?? null,
    gateway:           sub.gateway           ?? null,
    canceled_at:       sub.canceled_at       ?? null,
    payment_method:    sub.payment_method    ?? null,
    payment_last4:     sub.payment_last4     ?? null,
    created_at:        sub.created_at,
    updated_at:        sub.updated_at,
  });
});

export default router;
