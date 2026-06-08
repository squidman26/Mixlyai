import { completePurchaseFromPayment, getTierDefinition } from "../../lib/credits.js";
import { json } from "../../lib/api.js";
import {
  fetchSquareOrder,
  fetchSquarePayment,
  getSquareWebhookUrl,
  normalizeAccountId,
  verifySquareWebhookSignature,
} from "../../lib/square.js";

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function parsePaymentNote(note) {
  if (!note) return null;

  if (note.startsWith("mixly:") || note.startsWith("m:")) {
    const [, accountId, tierId] = note.split(":");
    if (!accountId || !tierId) return null;
    return { accountId: normalizeAccountId(accountId), tierId };
  }

  return null;
}

function resolvePurchaseMeta(payment, order) {
  const metadata = order?.metadata ?? {};
  const accountId = metadata.account_id || metadata.accountId;
  const tierId = metadata.tier;

  if (accountId && tierId && getTierDefinition(tierId)?.id !== "free") {
    return { accountId, tierId, orderId: order?.id ?? payment.order_id ?? null };
  }

  const fromNote = parsePaymentNote(payment.note);
  if (fromNote) {
    return {
      accountId: fromNote.accountId,
      tierId: fromNote.tierId,
      orderId: order?.id ?? payment.order_id ?? null,
    };
  }

  const referenceId = order?.referenceId || order?.reference_id;
  if (referenceId?.includes(":")) {
    const [refAccountId, refTierId] = referenceId.split(":");
    if (refAccountId && refTierId) {
      return {
        accountId: normalizeAccountId(refAccountId),
        tierId: refTierId,
        orderId: order?.id ?? payment.order_id ?? null,
      };
    }
  }

  return null;
}

async function resolvePaymentFromEvent(event) {
  const payment =
    event.data?.object?.payment ??
    event.data?.object?.payment_updated?.payment ??
    event.data?.object?.payment_created?.payment;

  if (payment?.id) return payment;

  const paymentId = event.data?.id;
  if (paymentId && event.data?.type === "payment") {
    return fetchSquarePayment(paymentId);
  }

  return null;
}

async function handlePaymentUpdated(payment) {
  if (!payment?.id || payment.status !== "COMPLETED") return;

  const order = await fetchSquareOrder(payment.order_id ?? payment.orderId);
  const meta = resolvePurchaseMeta(payment, order);
  if (!meta) {
    console.warn("Square payment completed without Mixly metadata:", payment.id);
    return;
  }

  await completePurchaseFromPayment({
    paymentId: payment.id,
    orderId: meta.orderId,
    tierId: meta.tierId,
    accountId: meta.accountId,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  let rawBody = "";
  try {
    rawBody = await readRawBody(req);
    const signature = req.headers["x-square-hmacsha256-signature"];
    const valid = await verifySquareWebhookSignature(signature, rawBody);
    if (!valid) {
      console.error("Invalid Square webhook signature for", getSquareWebhookUrl());
      json(res, 403, { error: "Invalid signature" });
      return;
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type;

    if (eventType === "payment.updated" || eventType === "payment.created") {
      const payment = await resolvePaymentFromEvent(event);
      await handlePaymentUpdated(payment);
    }

    json(res, 200, { received: true });
  } catch (err) {
    console.error("Square webhook error:", err.message);
    json(res, 500, { error: err.message || "Webhook failed" });
  }
}
