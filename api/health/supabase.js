import { checkSupabaseAccountsTable, isSupabaseConfigured } from "../../lib/supabase.js";
import { json, requireMethod } from "../../lib/api.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;

  if (!isSupabaseConfigured()) {
    json(res, 503, {
      ok: false,
      configured: false,
      error:
        "Add SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables.",
    });
    return;
  }

  const result = await checkSupabaseAccountsTable();
  json(res, result.ok ? 200 : 503, {
    ok: result.ok,
    configured: true,
    error: result.error ?? null,
  });
}
