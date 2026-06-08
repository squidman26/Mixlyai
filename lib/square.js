import { createHmac, randomUUID } from "crypto";
import { getCanonicalBaseUrl } from "./config.js";
import { getTierDefinition } from "./credits.js";

const SQUARE_API_VERSION = "2025-10-16";

function trimEnv(name) {
  return process.env[name]?.trim() || "";
}

function getSquareBaseUrl() {
  return trimEnv("SQUARE_ENVIRONMENT") === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

function getSquareAccessToken() {
  const accessToken = trimEnv("SQUARE_ACCESS_TOKEN");
  if (!accessToken) {
    throw new Error("Square is not configured. Add SQUARE_ACCESS_TOKEN.");
  }
  return accessToken;
}

async function squareRequest(path, { method = "GET", body } = {}) {
  const res = await fetch(`${getSquareBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getSquareAccessToken()}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_API_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      data.errors?.map((err) => err.detail || err.code).filter(Boolean).join("; ") ||
      res.statusText;
    throw new Error(`Square API error (${res.status}): ${detail}`);
  }

  return data;
}

export function isSquareConfigured() {
  return Boolean(
    trimEnv("SQUARE_ACCESS_TOKEN") && trimEnv("SQUARE_LOCATION_ID")
  );
}

export function getSquareWebhookUrl() {
  if (trimEnv("SQUARE_WEBHOOK_URL")) {
    return trimEnv("SQUARE_WEBHOOK_URL").replace(/\/$/, "");
  }
  return `${getCanonicalBaseUrl()}/api/webhooks/square`;
}

export function compactAccountId(accountId) {
  return String(accountId || "").replace(/-/g, "");
}

export function normalizeAccountId(accountId) {
  const value = String(accountId || "").trim();
  if (!value) return value;
  if (value.includes("-")) return value;
  if (value.length !== 32) return value;
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function buildSquareReferenceId(accountId, tierId) {
  return `${compactAccountId(accountId)}:${tierId}`;
}

function buildSquarePaymentNote(accountId, tierId) {
  return `m:${compactAccountId(accountId)}:${tierId}`;
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

  const data = await squareRequest("/v2/online-checkout/payment-links", {
    method: "POST",
    body: {
      idempotency_key: randomUUID(),
      description: `Mixly ${tier.name} credits`,
      order: {
        location_id: locationId,
        reference_id: buildSquareReferenceId(accountId, tier.id),
        line_items: [
          {
            name: `Mixly ${tier.name} — ${tier.credits} credits`,
            quantity: "1",
            base_price_money: {
              amount: tier.priceCents,
              currency: "USD",
            },
          },
        ],
        metadata: {
          account_id: accountId,
          tier: tier.id,
          app: "mixly",
        },
      },
      checkout_options: {
        redirect_url:
          redirectUrl || `${getCanonicalBaseUrl()}/?purchase=success&tier=${tier.id}`,
        ask_for_shipping_address: false,
        allow_tipping: false,
      },
      payment_note: buildSquarePaymentNote(accountId, tier.id),
    },
  });

  const paymentLink = data.payment_link;
  if (!paymentLink?.url) {
    throw new Error("Square did not return a checkout URL");
  }

  return {
    url: paymentLink.url,
    paymentLinkId: paymentLink.id,
    orderId: paymentLink.order_id ?? null,
  };
}

export async function verifySquareWebhookSignature(signature, rawBody) {
  const signatureKey = trimEnv("SQUARE_WEBHOOK_SIGNATURE_KEY");
  if (!signatureKey) {
    throw new Error("Square webhook signature key is not configured");
  }

  const payload = getSquareWebhookUrl() + rawBody;
  const expected = createHmac("sha256", signatureKey)
    .update(payload, "utf8")
    .digest("base64");

  return expected === signature;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchSquareOrder(orderId) {
  if (!orderId) return null;

  const data = await squareRequest(`/v2/orders/${encodeURIComponent(orderId)}`);
  return data.order ?? null;
}

export async function fetchPaymentLink(paymentLinkId) {
  if (!paymentLinkId) return null;

  const data = await squareRequest(
    `/v2/online-checkout/payment-links/${encodeURIComponent(paymentLinkId)}`
  );
  return data.payment_link ?? null;
}

function getPaymentIdFromTenders(tenders = []) {
  for (const tender of tenders) {
    if (tender.payment_id) return tender.payment_id;
    if (tender.id) return tender.id;
  }
  return null;
}

async function fetchPaymentById(paymentId) {
  if (!paymentId) return null;

  const data = await squareRequest(`/v2/payments/${encodeURIComponent(paymentId)}`);
  const payment = data.payment ?? null;
  return payment?.status === "COMPLETED" ? payment : null;
}

async function fetchCompletedPaymentFromOrder(order) {
  if (!order) return null;

  const paymentId = getPaymentIdFromTenders(order.tenders);
  if (paymentId) {
    const payment = await fetchPaymentById(paymentId);
    if (payment) return payment;
  }

  return null;
}

async function fetchCompletedPaymentFromRecentPayments(orderId) {
  const locationId = trimEnv("SQUARE_LOCATION_ID");
  if (!locationId || !orderId) return null;

  const beginTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const data = await squareRequest(
    `/v2/payments?location_id=${encodeURIComponent(locationId)}&begin_time=${encodeURIComponent(beginTime)}&sort_order=DESC&limit=100`
  );

  return (
    (data.payments ?? []).find(
      (payment) => payment.order_id === orderId && payment.status === "COMPLETED"
    ) ?? null
  );
}

export async function fetchCompletedPaymentForOrder(orderId, { retries = 4, delayMs = 1500 } = {}) {
  if (!orderId) return null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    const order = await fetchSquareOrder(orderId);
    const payment =
      (await fetchCompletedPaymentFromOrder(order)) ??
      (await fetchCompletedPaymentFromRecentPayments(orderId));

    if (payment?.id) return payment;

    if (attempt < retries - 1) {
      await sleep(delayMs);
    }
  }

  return null;
}

export async function resolveCompletedPaymentForPending(pending) {
  let orderId = pending?.square_order_id ?? null;

  if (!orderId && pending?.square_payment_link_id) {
    const paymentLink = await fetchPaymentLink(pending.square_payment_link_id);
    orderId = paymentLink?.order_id ?? null;
  }

  if (!orderId) return { payment: null, orderId: null };

  const payment = await fetchCompletedPaymentForOrder(orderId);
  return { payment, orderId };
}

export async function fetchSquarePayment(paymentId) {
  return fetchPaymentById(paymentId);
}
