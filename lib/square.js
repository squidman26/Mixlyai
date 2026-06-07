import { randomUUID } from "crypto";
import { SquareClient, SquareEnvironment, WebhooksHelper } from "square";
import { getCanonicalBaseUrl } from "./config.js";
import { getTierDefinition } from "./credits.js";

function trimEnv(name) {
  return process.env[name]?.trim() || "";
}

export function isSquareConfigured() {
  return Boolean(
    trimEnv("SQUARE_ACCESS_TOKEN") && trimEnv("SQUARE_LOCATION_ID")
  );
}

function getSquareClient() {
  const accessToken = trimEnv("SQUARE_ACCESS_TOKEN");
  if (!accessToken) {
    throw new Error("Square is not configured. Add SQUARE_ACCESS_TOKEN.");
  }

  const environment =
    trimEnv("SQUARE_ENVIRONMENT") === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox;

  return new SquareClient({
    token: accessToken,
    environment,
  });
}

export function getSquareWebhookUrl() {
  if (trimEnv("SQUARE_WEBHOOK_URL")) {
    return trimEnv("SQUARE_WEBHOOK_URL").replace(/\/$/, "");
  }
  return `${getCanonicalBaseUrl()}/api/webhooks/square`;
}

export async function createTierCheckoutLink({ tierId, accountId, redirectUrl }) {
  const tier = getTierDefinition(tierId);
  if (!tier || tier.id === "free") {
    throw new Error("Only Basic and Pro tiers can be purchased");
  }

  const locationId = trimEnv("SQUARE_LOCATION_ID");
  if (!locationId) {
    throw new Error("Square location ID is not configured");
  }

  const client = getSquareClient();
  const response = await client.checkout.paymentLinks.create({
    idempotencyKey: randomUUID(),
    description: `Spotifybot ${tier.name} credits`,
    order: {
      locationId,
      referenceId: `${accountId}:${tier.id}`,
      lineItems: [
        {
          name: `Spotifybot ${tier.name} — ${tier.credits} credits`,
          quantity: "1",
          basePriceMoney: {
            amount: BigInt(tier.priceCents),
            currency: "USD",
          },
        },
      ],
      metadata: {
        account_id: accountId,
        tier: tier.id,
        app: "spotifybot",
      },
    },
    checkoutOptions: {
      redirectUrl:
        redirectUrl || `${getCanonicalBaseUrl()}/?purchase=success&tier=${tier.id}`,
      askForShippingAddress: false,
      allowTipping: false,
    },
    paymentNote: `spotifybot:${accountId}:${tier.id}`,
  });

  const paymentLink = response.data?.paymentLink;
  if (!paymentLink?.url) {
    throw new Error("Square did not return a checkout URL");
  }

  return {
    url: paymentLink.url,
    paymentLinkId: paymentLink.id,
    orderId: paymentLink.orderId ?? paymentLink.order_id ?? null,
  };
}

export async function verifySquareWebhookSignature(signature, rawBody) {
  const signatureKey = trimEnv("SQUARE_WEBHOOK_SIGNATURE_KEY");
  if (!signatureKey) {
    throw new Error("Square webhook signature key is not configured");
  }

  return WebhooksHelper.verifySignature({
    requestBody: rawBody,
    signatureHeader: signature,
    signatureKey,
    notificationUrl: getSquareWebhookUrl(),
  });
}

export async function fetchSquareOrder(orderId) {
  if (!orderId) return null;

  const client = getSquareClient();
  const response = await client.orders.get({ orderId });
  return response.data?.order ?? null;
}
