#!/usr/bin/env node
/**
 * Add or update a Vercel environment variable.
 *
 * Usage:
 *   VERCEL_TOKEN=... node scripts/add-vercel-env.mjs SUPABASE_SECRET_KEY sb_secret_...
 */

const [key, value] = process.argv.slice(2);
const token = process.env.VERCEL_TOKEN;
const projectId =
  process.env.VERCEL_PROJECT_ID || "prj_6RMMl8r1Z09XCNTzCGooBwR4J6Fn";

if (!key || !value) {
  console.error("Usage: VERCEL_TOKEN=... node scripts/add-vercel-env.mjs KEY VALUE");
  process.exit(1);
}

if (!token) {
  console.error("Missing VERCEL_TOKEN. Create one at https://vercel.com/account/tokens");
  process.exit(1);
}

async function getProjectId() {
  if (process.env.VERCEL_PROJECT_ID) return process.env.VERCEL_PROJECT_ID;

  const res = await fetch("https://api.vercel.com/v9/projects?search=mixly", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  const project =
    body.projects?.find((p) => p.name?.includes("mixly")) ??
    body.projects?.[0];
  if (!project?.id) throw new Error("Could not find Vercel project");
  return project.id;
}

async function main() {
  const id = await getProjectId();
  const listRes = await fetch(`https://api.vercel.com/v9/projects/${id}/env`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const existing = await listRes.json();
  const found = existing.envs?.find((env) => env.key === key);

  const payload = {
    key,
    value,
    type:
      key.includes("SECRET") || key.includes("SERVICE_ROLE") || key.includes("KEY")
        ? "encrypted"
        : "plain",
    target: ["production", "preview", "development"],
  };

  const url = found
    ? `https://api.vercel.com/v9/projects/${id}/env/${found.id}`
    : `https://api.vercel.com/v10/projects/${id}/env`;

  const res = await fetch(url, {
    method: found ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${res.status}: ${body.error?.message || JSON.stringify(body)}`);
  }

  console.log(`Set Vercel env ${key} on project ${id} (${found ? "updated" : "created"})`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
