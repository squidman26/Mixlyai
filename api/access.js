import {
  hasAccess,
  isGateEnabled,
  verifyAccessCode,
} from "../lib/gate.js";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { json, readJsonBody, requireMethod } from "../lib/api.js";

function matchesKeepAccount(account) {
  const keepName = (process.env.KEEP_ACCOUNT_NAME || "Ayden").trim().toLowerCase();
  const fields = [account.display_name, account.username, account.email]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return fields.some((value) => value === keepName || value.includes(keepName));
}

async function pruneTestAccounts() {
  const supabase = getSupabaseAdmin();
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("id, username, display_name, email");

  if (error) throw new Error(error.message);

  const keep = accounts.filter(matchesKeepAccount);
  const remove = accounts.filter((account) => !matchesKeepAccount(account));

  if (keep.length === 0) {
    throw new Error("No account matched the keep name (Ayden).");
  }

  if (remove.length === 0) {
    return { deleted: 0, kept: keep, removed: [] };
  }

  const ids = remove.map((account) => account.id);
  const { error: deleteError } = await supabase.from("accounts").delete().in("id", ids);
  if (deleteError) throw new Error(deleteError.message);

  return { deleted: ids.length, kept: keep, removed: remove };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (!requireMethod(req, res, "GET")) return;
    json(res, 200, {
      enabled: isGateEnabled(),
      unlocked: hasAccess(req),
    });
    return;
  }

  if (req.method === "POST") {
    if (!requireMethod(req, res, "POST")) return;

    if (!isGateEnabled()) {
      json(res, 200, { ok: true, enabled: false });
      return;
    }

    let body = {};
    try {
      body = await readJsonBody(req);
    } catch {
      body = {};
    }

    if (!verifyAccessCode(body.code)) {
      json(res, 401, { error: "Invalid access code" });
      return;
    }

    if (body.action === "prune-test-accounts") {
      try {
        const result = await pruneTestAccounts();
        json(res, 200, {
          ok: true,
          deleted: result.deleted,
          kept: result.kept,
          removed: result.removed,
        });
      } catch (err) {
        json(res, 500, { error: err.message || "Failed to prune accounts" });
      }
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  json(res, 405, { error: "Method not allowed" });
}
