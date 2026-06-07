import { getTierDefinition, recordPendingPurchase } from "../../lib/credits.js";
import {
  getSession,
  json,
  readJsonBody,
  requireMethod,
  requireSpotifySession,
} from "../../lib/api.js";
import { getBaseUrl } from "../../lib/config.js";
import { requireAccess } from "../../lib/gate.js";
import { createTierCheckoutLink, isSquareConfigured } from "../../lib/square.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  if (!requireAccess(req, res)) return;

  const { session } = getSession(req, res);
  if (!requireSpotifySession(req, res, session)) return;

  if (!session.accountId) {
    json(res, 400, { error: "Account not synced yet. Refresh and try again." });
    return;
  }

  if (!isSquareConfigured()) {
    json(res, 503, { error: "Square payments are not configured yet." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const tierId = body.tier;
    const tier = getTierDefinition(tierId);

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
  } catch (err) {
    json(res, 500, { error: err.message || "Failed to create checkout" });
  }
}
