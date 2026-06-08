import crypto from "crypto";
import { getSupabaseAdmin } from "./supabase.js";

export const TOKEN_TYPES = {
  VERIFY_EMAIL: "verify_email",
  RESET_PASSWORD: "reset_password",
};

const TOKEN_BYTES = 32;
const EXPIRY_HOURS = {
  [TOKEN_TYPES.VERIFY_EMAIL]: 24,
  [TOKEN_TYPES.RESET_PASSWORD]: 1,
};

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function expiryForType(tokenType) {
  const hours = EXPIRY_HOURS[tokenType] ?? 24;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export async function createAuthToken(accountId, tokenType) {
  const supabase = getSupabaseAdmin();
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = expiryForType(tokenType);

  await supabase
    .from("auth_tokens")
    .delete()
    .eq("account_id", accountId)
    .eq("token_type", tokenType)
    .is("used_at", null);

  const { error } = await supabase.from("auth_tokens").insert({
    account_id: accountId,
    token_type: tokenType,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Failed to create auth token: ${error.message}`);
  }

  return { token, expiresAt };
}

export async function consumeAuthToken(token, tokenType) {
  if (!token?.trim()) return null;

  const supabase = getSupabaseAdmin();
  const tokenHash = hashToken(token.trim());
  const now = new Date().toISOString();

  const { data: row, error } = await supabase
    .from("auth_tokens")
    .select("id, account_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .eq("token_type", tokenType)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate token: ${error.message}`);
  }

  if (!row || row.used_at) return null;
  if (row.expires_at <= now) return null;

  const { error: updateError } = await supabase
    .from("auth_tokens")
    .update({ used_at: now })
    .eq("id", row.id)
    .is("used_at", null);

  if (updateError) {
    throw new Error(`Failed to consume token: ${updateError.message}`);
  }

  return row.account_id;
}
