import {
  buildCreditStatus,
  ensureAccountCredits,
  getAccountCredits,
  getTierDefinition,
  listCreditTransactions,
  recordPendingPurchase,
} from "../lib/credits.js";
import {
  getSession,
  json,
  readJsonBody,
  requireAppSession,
  requireMethod,
} from "../lib/api.js";
import { getBaseUrl } from "../lib/config.js";
import { requireAccess } from "../lib/gate.js";
import { createTierCheckoutLink, isSquareConfigured } from "../lib/square.js";
import { checkSupabaseCreditSchema } from "../lib/supabase.js";

async function getCreditsStatus(req, res) {
  const { session } = getSession(req, res);
  if (!requireAppSession(req, res, session)) return;

  const schema = await checkSupabaseCreditSchema();
  if (!schema.ok) {
    json(res, 503, { error: schema.error });
    return;
  }

  let account = await getAccountCredits(session.accountId);
  if (!account) {
    json(res, 404, { error: "Account not found" });
    return;
  }

  account = await ensureAccountCredits(null, account);
  const transactions = await listCreditTransactions(session.accountId);

  json(res, 200, {
    ...buildCreditStatus(account, null),
    squareConfigured: isSquareConfigured(),
    supabaseSynced: true,
    transactions,
  });
}

async function createCheckout(req, res) {
  const { session } = getSession(req, res);
  if (!requireAppSession(req, res, session)) return;

  if (!isSquareConfigured()) {
    json(res, 503, { error: "Square payments are not configured yet." });
    return;
  }

  const body = await readJsonBody(req);
  const tier = getTierDefinition(body.tier);

  if (!tier || tier.id === "free") {
    json(res, 400, { error: "Choose Basic or Pro to purchase credits." });
    return;
  }

  const redirectUrl = `${getBaseUrl(req)}/?purchase=success&tier=${tier.id}`;
  const checkout = await createTierCheckoutLink({
    tierId: tier.id,
    accountId: session.accountId,
    redirectUrl,
  });

  await recordPendingPurchase(session.accountId, tier.id, {
    paymentLinkId: checkout.paymentLinkId,
    orderId: checkout.orderId,
  });

  json(res, 200, {
    url: checkout.url,
    tier: tier.id,
    credits: tier.credits,
    priceLabel: tier.priceLabel,
  });
}

export default async function handler(req, res) {
  if (!requireAccess(req, res)) return;

  if (req.method === "GET") {
    try {
      await getCreditsStatus(req, res);
    } catch (err) {
      json(res, 500, { error: err.message || "Failed to load credits" });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      await createCheckout(req, res);
    } catch (err) {
      json(res, 500, { error: err.message || "Failed to create checkout" });
    }
    return;
  }

  json(res, 405, { error: "Method not allowed" });
}
