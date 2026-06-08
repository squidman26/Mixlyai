#!/usr/bin/env node
/**
 * Enable Google OAuth on a hosted Supabase project (Management API).
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... \
 *   GOOGLE_CLIENT_ID=... \
 *   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=... \
 *   node scripts/configure-supabase-google.mjs
 */

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF || "npkmlflciakpzkskkqvy";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET;

if (!ACCESS_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Required: SUPABASE_ACCESS_TOKEN, GOOGLE_CLIENT_ID, SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET"
  );
  process.exit(1);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_google_enabled: true,
      external_google_client_id: CLIENT_ID,
      external_google_secret: CLIENT_SECRET,
    }),
  }
);

const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("Failed to configure Google provider:", JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log("Google provider enabled for project", PROJECT_REF);
