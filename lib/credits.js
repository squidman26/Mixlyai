import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase.js";

export const TIERS = {
  free: {
    id: "free",
    name: "Free",
    credits: 100,
    priceCents: 0,
    priceLabel: "$0",
  },
  basic: {
    id: "basic",
    name: "Basic",
    credits: 500,
    priceCents: 500,
    priceLabel: "$5",
  },
  pro: {
    id: "pro",
    name: "Pro",
    credits: 2000,
    priceCents: 1500,
    priceLabel: "$15",
  },
};

export const CREDIT_COSTS = {
  chatMessage: 1,
  exportPlaylist: 2,
};

const ACCOUNT_CREDIT_COLUMNS =
  "id, username, display_name, email, credits, tier, unlimited_credits";

function parseUnlimitedAccountIds() {
  return (process.env.UNLIMITED_CREDITS_ACCOUNT_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isUnlimitedAccount(_user, account) {
  if (account?.unlimited_credits) return true;

  if (account?.id && parseUnlimitedAccountIds().includes(account.id)) {
    return true;
  }

  const username = (account?.username || account?.display_name || "")
    .trim()
    .toLowerCase();
  return username === "ayden";
}

export function getTierDefinition(tierId) {
  return TIERS[tierId] ?? TIERS.free;
}

export function getPurchasableTiers() {
  return [TIERS.basic, TIERS.pro];
}

export function buildCreditStatus(account, user) {
  const unlimited = isUnlimitedAccount(user, account);
  const tier = getTierDefinition(account?.tier || "free");

  return {
    unlimited,
    credits: unlimited ? null : account?.credits ?? tier.credits,
    tier: tier.id,
    tierName: tier.name,
    tierCredits: tier.credits,
    costs: CREDIT_COSTS,
    accountId: account?.id ?? null,
    tiers: Object.values(TIERS).map(({ id, name, credits, priceLabel }) => ({
      id,
      name,
      credits,
      priceLabel,
    })),
  };
}

async function recordCreditTransaction({
  accountId,
  amount,
  balanceAfter,
  reason,
  referenceId = null,
  metadata = {},
}) {
  if (!isSupabaseConfigured() || !accountId) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("credit_transactions").insert({
    account_id: accountId,
    amount,
    balance_after: balanceAfter,
    reason,
    reference_id: referenceId,
    metadata,
  });

  if (error) {
    console.error("Failed to record credit transaction:", error.message);
  }
}

export async function listCreditTransactions(accountId, limit = 20) {
  if (!isSupabaseConfigured() || !accountId) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("id, amount, balance_after, reason, reference_id, metadata, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load credit transactions: ${error.message}`);
  }

  return data ?? [];
}

export async function recordInitialAccountCredits(account) {
  if (!account?.id || account.credits == null) return;

  await recordCreditTransaction({
    accountId: account.id,
    amount: account.credits,
    balanceAfter: account.credits,
    reason: "initial_grant",
    metadata: { tier: account.tier || "free" },
  });
}

export async function ensureAccountCredits(user, account) {
  if (!account?.id || !isSupabaseConfigured()) return account;

  const unlimited = isUnlimitedAccount(user, account);
  const updates = {};

  if (unlimited && !account.unlimited_credits) {
    updates.unlimited_credits = true;
  }

  if (!unlimited && account.credits == null) {
    updates.credits = getTierDefinition(account.tier || "free").credits;
  }

  if (!account.tier) {
    updates.tier = "free";
  }

  if (!Object.keys(updates).length) return account;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", account.id)
    .select(ACCOUNT_CREDIT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to sync account credits: ${error.message}`);
  }

  if (updates.credits != null) {
    await recordCreditTransaction({
      accountId: account.id,
      amount: updates.credits,
      balanceAfter: data.credits,
      reason: "initial_sync",
      metadata: { tier: data.tier },
    });
  }

  return data;
}

export async function getAccountCredits(accountId) {
  if (!isSupabaseConfigured() || !accountId) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_CREDIT_COLUMNS)
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load account credits: ${error.message}`);
  }

  return data;
}

export async function deductCredits(accountId, amount, user) {
  if (!accountId || amount <= 0) {
    return { ok: true, credits: null, unlimited: false };
  }

  const account = await getAccountCredits(accountId);
  if (!account) {
    throw new Error("Account not found");
  }

  if (isUnlimitedAccount(user, account)) {
    return {
      ok: true,
      credits: null,
      unlimited: true,
      tier: account.tier || "free",
    };
  }

  if (account.credits < amount) {
    return {
      ok: false,
      credits: account.credits,
      unlimited: false,
      tier: account.tier || "free",
      required: amount,
    };
  }

  const supabase = getSupabaseAdmin();
  const nextCredits = account.credits - amount;
  const { data, error } = await supabase
    .from("accounts")
    .update({
      credits: nextCredits,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .eq("credits", account.credits)
    .select("credits, tier, unlimited_credits")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to deduct credits: ${error.message}`);
  }

  if (!data) {
    return deductCredits(accountId, amount, user);
  }

  await recordCreditTransaction({
    accountId,
    amount: -amount,
    balanceAfter: data.credits,
    reason: amount === CREDIT_COSTS.chatMessage ? "chat_message" : "export_playlist",
    metadata: { tier: data.tier },
  });

  return {
    ok: true,
    credits: data.credits,
    unlimited: false,
    tier: data.tier || "free",
  };
}

export async function applyTierUpgrade(accountId, tierId, paymentMeta = {}) {
  const tier = getTierDefinition(tierId);
  if (!tier || tier.id === "free") {
    throw new Error("Invalid paid tier");
  }

  const previous = await getAccountCredits(accountId);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .update({
      tier: tier.id,
      credits: tier.credits,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .select(ACCOUNT_CREDIT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to grant credits: ${error.message}`);
  }

  await recordCreditTransaction({
    accountId,
    amount: tier.credits - (previous?.credits ?? 0),
    balanceAfter: data.credits,
    reason: "tier_upgrade",
    referenceId: paymentMeta.paymentId ?? paymentMeta.orderId ?? null,
    metadata: {
      tier: tier.id,
      paymentLinkId: paymentMeta.paymentLinkId ?? null,
      orderId: paymentMeta.orderId ?? null,
    },
  });

  return data;
}

export async function grantTierCredits(accountId, tierId, paymentMeta = {}) {
  const account = await applyTierUpgrade(accountId, tierId, paymentMeta);

  const supabase = getSupabaseAdmin();
  const tier = getTierDefinition(tierId);
  const { error: purchaseError } = await supabase.from("credit_purchases").insert({
    account_id: accountId,
    tier: tier.id,
    credits_granted: tier.credits,
    amount_cents: tier.priceCents,
    square_payment_link_id: paymentMeta.paymentLinkId ?? null,
    square_order_id: paymentMeta.orderId ?? null,
    square_payment_id: paymentMeta.paymentId ?? null,
    status: "completed",
    completed_at: new Date().toISOString(),
  });

  if (purchaseError && purchaseError.code !== "23505") {
    throw new Error(`Failed to record purchase: ${purchaseError.message}`);
  }

  return account;
}

export async function recordPendingPurchase(accountId, tierId, paymentMeta = {}) {
  const tier = getTierDefinition(tierId);
  if (!tier || tier.id === "free") {
    throw new Error("Invalid paid tier");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("credit_purchases")
    .insert({
      account_id: accountId,
      tier: tier.id,
      credits_granted: tier.credits,
      amount_cents: tier.priceCents,
      square_payment_link_id: paymentMeta.paymentLinkId ?? null,
      square_order_id: paymentMeta.orderId ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to record pending purchase: ${error.message}`);
  }

  return data;
}

export async function completePurchaseFromPayment({
  paymentId,
  orderId,
  tierId,
  accountId,
}) {
  if (!paymentId || !accountId || !tierId) return null;

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("credit_purchases")
    .select("id, status")
    .eq("square_payment_id", paymentId)
    .maybeSingle();

  if (existing?.status === "completed") {
    return getAccountCredits(accountId);
  }

  const account = await applyTierUpgrade(accountId, tierId, { paymentId, orderId });

  if (orderId) {
    const { data: pending } = await supabase
      .from("credit_purchases")
      .update({
        square_payment_id: paymentId,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("square_order_id", orderId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!pending) {
      const tier = getTierDefinition(tierId);
      await supabase.from("credit_purchases").insert({
        account_id: accountId,
        tier: tier.id,
        credits_granted: tier.credits,
        amount_cents: tier.priceCents,
        square_order_id: orderId,
        square_payment_id: paymentId,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
    }
  } else {
    await grantTierCredits(accountId, tierId, { paymentId, orderId });
  }

  return account;
}
