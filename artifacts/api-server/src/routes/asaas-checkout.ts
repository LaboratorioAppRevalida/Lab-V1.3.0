import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── Asaas plan catalogue ───────────────────────────────────────────────────

type AsaasCycle = "MONTHLY" | "SEMIANNUAL" | "YEARLY";

interface PlanDef {
  name:  string;
  value: number;
  cycle: AsaasCycle;
}

const PLANS: Record<string, PlanDef> = {
  mensal:    { name: "Plano Mensal — Revalida 2ª Fase",    value: 189.90,  cycle: "MONTHLY"   },
  semestral: { name: "Plano Semestral — Revalida 2ª Fase", value: 1082.43, cycle: "SEMIANNUAL" },
  anual:     { name: "Plano Anual — Revalida 2ª Fase",     value: 2050.92, cycle: "YEARLY"    },
};

// ── Asaas API helpers ──────────────────────────────────────────────────────

function asaasBaseUrl() {
  return process.env.ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
}

/**
 * Wraps a fetch to the Asaas REST API.
 * Uses res.text() first so a non-JSON response never causes a cryptic
 * "Unexpected token" crash — instead we surface the raw body in the error.
 */
async function asaasRequest<T>(
  method: "GET" | "POST",
  path:   string,
  body?:  unknown,
): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não está configurada nos Secrets do Replit");

  const url = `${asaasBaseUrl()}${path}`;
  console.log(`[asaas] ${method} ${url}`);

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": apiKey,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const raw = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error(`[asaas] resposta não-JSON (status ${res.status}):`, raw.slice(0, 500));
    throw new Error(`Asaas retornou uma resposta não-JSON (status ${res.status}). Verifique a ASAAS_API_KEY e o ASAAS_ENV.`);
  }

  if (!res.ok) {
    const detail = JSON.stringify(data.errors ?? data);
    console.error(`[asaas] erro ${res.status}:`, detail);
    throw new Error(`Asaas API error ${res.status}: ${detail}`);
  }

  console.log(`[asaas] ${method} ${path} → ok`);
  return data as T;
}

const asaasGet  = <T>(path: string)              => asaasRequest<T>("GET",  path);
const asaasPost = <T>(path: string, body: unknown) => asaasRequest<T>("POST", path, body);

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ── POST /checkout/asaas ───────────────────────────────────────────────────

router.post("/checkout/asaas", async (req, res) => {
  const { planId, userId, userEmail, userName } = req.body as {
    planId:    string;
    userId:    string;
    userEmail: string;
    userName:  string;
  };

  // ── Validate request body ────────────────────────────────────────────────
  if (!planId || !userId || !userEmail) {
    res.status(400).json({ error: "planId, userId e userEmail são obrigatórios" });
    return;
  }

  const plan = PLANS[planId];
  if (!plan) {
    res.status(400).json({ error: `planId desconhecido: "${planId}". Valores aceitos: ${Object.keys(PLANS).join(", ")}` });
    return;
  }

  // ── Validate secrets before touching anything external ───────────────────
  const missingSecrets: string[] = [];
  if (!process.env.ASAAS_API_KEY)             missingSecrets.push("ASAAS_API_KEY");
  if (!process.env.SUPABASE_URL)              missingSecrets.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingSecrets.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missingSecrets.length > 0) {
    const msg = `Secrets não configuradas no servidor: ${missingSecrets.join(", ")}`;
    console.error("[asaas-checkout] ❌", msg);
    res.status(500).json({ error: msg });
    return;
  }

  console.log(`[asaas-checkout] iniciando checkout — planId="${planId}" userId="${userId}" email="${userEmail}"`);
  console.log(`[asaas-checkout] ambiente Asaas: ${process.env.ASAAS_ENV ?? "sandbox (padrão)"}`);
  console.log(`[asaas-checkout] base URL: ${asaasBaseUrl()}`);

  logger.info({ planId, userId }, "[asaas-checkout] creating checkout");

  try {
    // ── Step 1: Get or create Asaas customer ────────────────────────────────
    console.log("[asaas-checkout] step 1 — buscando customer_id existente no DB...");
    const { data: existingSub, error: subQueryErr } = await supabaseAdmin
      .from("subscriptions")
      .select("gateway_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (subQueryErr) {
      console.error("[asaas-checkout] erro ao consultar subscriptions no Supabase:", subQueryErr);
    }

    let customerId = existingSub?.gateway_customer_id as string | null | undefined;
    console.log(`[asaas-checkout] gateway_customer_id no DB: ${customerId ?? "nenhum"}`);

    if (!customerId) {
      console.log("[asaas-checkout] step 1b — buscando customer por externalReference no Asaas...");
      const search = await asaasGet<{ data: Array<{ id: string }> }>(
        `/customers?externalReference=${encodeURIComponent(userId)}`
      );
      customerId = search.data?.[0]?.id ?? null;
      console.log(`[asaas-checkout] customer encontrado no Asaas: ${customerId ?? "nenhum"}`);
    }

    if (!customerId) {
      console.log("[asaas-checkout] step 1c — criando novo customer no Asaas...");
      const customerPayload = {
        name:              userName || userEmail.split("@")[0],
        email:             userEmail,
        externalReference: userId,
        notificationDisabled: false,
      };
      console.log("[asaas-checkout] customer payload:", JSON.stringify(customerPayload));

      const customer = await asaasPost<{ id: string }>("/customers", customerPayload);
      customerId = customer.id;
      console.log(`[asaas-checkout] customer criado: ${customerId}`);
      logger.info({ customerId, userId }, "[asaas-checkout] customer created");
    }

    // ── Step 2: Create subscription in Asaas ────────────────────────────────
    const subscriptionPayload = {
      customer:          customerId,
      billingType:       "UNDEFINED",
      value:             plan.value,
      nextDueDate:       todayStr(),
      cycle:             plan.cycle,
      externalReference: userId,
      description:       plan.name,
    };
    console.log("[asaas-checkout] step 2 — criando subscription:", JSON.stringify(subscriptionPayload));

    const subscription = await asaasPost<{ id: string }>("/subscriptions", subscriptionPayload);
    console.log(`[asaas-checkout] subscription criada: ${subscription.id}`);

    // ── Step 3: Get first pending payment → invoiceUrl ───────────────────────
    console.log("[asaas-checkout] step 3 — buscando primeiro pagamento da subscription...");
    const payments = await asaasGet<{
      data: Array<{ id: string; invoiceUrl: string; status: string }>;
    }>(`/subscriptions/${subscription.id}/payments?limit=1`);

    const firstPayment = payments.data?.[0];
    console.log(`[asaas-checkout] primeiro pagamento:`, JSON.stringify(firstPayment ?? null));

    if (!firstPayment?.invoiceUrl) {
      throw new Error("Asaas não retornou invoiceUrl para a subscription criada");
    }

    // ── Step 4: Upsert subscription in DB ───────────────────────────────────
    console.log("[asaas-checkout] step 4 — gravando subscription no Supabase...");
    const { error: dbError } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id:                 userId,
          plan_name:               planId.charAt(0).toUpperCase() + planId.slice(1),
          status:                  "pendente",
          gateway:                 "asaas",
          gateway_customer_id:     customerId,
          gateway_subscription_id: subscription.id,
          payment_method:          null,
        },
        { onConflict: "user_id" },
      );

    if (dbError) {
      console.error("[asaas-checkout] erro ao gravar no Supabase (não-fatal):", dbError);
      logger.error({ dbError }, "[asaas-checkout] DB upsert failed");
    } else {
      console.log("[asaas-checkout] subscription gravada no Supabase com sucesso");
    }

    logger.info({ userId, planId, subId: subscription.id }, "[asaas-checkout] checkout created");
    console.log(`[asaas-checkout] ✅ checkout concluído — invoiceUrl: ${firstPayment.invoiceUrl}`);

    res.json({ checkoutUrl: firstPayment.invoiceUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[asaas-checkout] ❌ Erro detalhado no Checkout Asaas:", err);
    logger.error({ err: message, planId, userId }, "[asaas-checkout] error");
    res.status(500).json({ error: message });
  }
});

export default router;
