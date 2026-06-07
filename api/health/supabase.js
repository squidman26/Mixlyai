import {
  checkSupabaseAccountsTable,
  checkSupabaseAuthSchema,
  checkSupabaseCreditSchema,
  isSupabaseConfigured,
} from "../../lib/supabase.js";
import { json, requireMethod } from "../../lib/api.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) return;

  if (!isSupabaseConfigured()) {
    json(res, 503, {
      ok: false,
      configured: false,
      creditsReady: false,
      error:
        "Add SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables.",
    });
    return;
  }

  const accountsResult = await checkSupabaseAccountsTable();
  const creditsResult = await checkSupabaseCreditSchema();
  const authResult = await checkSupabaseAuthSchema();
  const ok = accountsResult.ok && creditsResult.ok && authResult.ok;

  json(res, ok ? 200 : 503, {
    ok,
    configured: true,
    accountsReady: accountsResult.ok,
    creditsReady: creditsResult.ok,
    authReady: authResult.ok,
    error: authResult.error ?? creditsResult.error ?? accountsResult.error ?? null,
  });
}
