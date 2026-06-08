import { getSupabaseAdmin } from "../../lib/supabase.js";
import { json, requireMethod } from "../../lib/api.js";
import { getAccessCodeFromRequest, isGateEnabled, verifyAccessCode } from "../../lib/gate.js";

function matchesKeepAccount(account) {
  const keepName = (process.env.KEEP_ACCOUNT_NAME || "Ayden").trim().toLowerCase();
  const fields = [account.display_name, account.username]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return fields.some((value) => value === keepName);
}

function requireAdminAccess(req, res) {
  if (!isGateEnabled()) return true;
  const code = getAccessCodeFromRequest(req);
  if (verifyAccessCode(code)) return true;
  json(res, 403, { error: "access denied" });
  return false;
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) return;
  if (!requireAdminAccess(req, res)) return;

  try {
    const supabase = getSupabaseAdmin();
    const { data: accounts, error } = await supabase
      .from("accounts")
      .select("id, username, display_name, email");

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    const keep = accounts.filter(matchesKeepAccount);
    const remove = accounts.filter((account) => !matchesKeepAccount(account));

    if (keep.length === 0) {
      json(res, 400, { error: "No account matched the keep name (Ayden)." });
      return;
    }

    if (remove.length === 0) {
      json(res, 200, { ok: true, deleted: 0, kept: keep.map((a) => a.id) });
      return;
    }

    const ids = remove.map((account) => account.id);
    const { error: deleteError } = await supabase.from("accounts").delete().in("id", ids);

    if (deleteError) {
      json(res, 500, { error: deleteError.message });
      return;
    }

    json(res, 200, {
      ok: true,
      deleted: ids.length,
      removed: remove.map((account) => ({
        id: account.id,
        username: account.username,
        display_name: account.display_name,
        email: account.email,
      })),
      kept: keep.map((account) => ({
        id: account.id,
        username: account.username,
        display_name: account.display_name,
        email: account.email,
      })),
    });
  } catch (err) {
    json(res, 500, { error: err.message || "Failed to prune accounts" });
  }
}
