const API = "https://api.vercel.com";

export function requireToken() {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "Missing VERCEL_TOKEN. Create one at https://vercel.com/account/tokens"
    );
  }
  return token;
}

export async function vercelFetch(path, { method = "GET", body, teamId } = {}) {
  const token = requireToken();
  const url = new URL(`${API}${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error?.message || JSON.stringify(data);
    throw new Error(`${method} ${path} failed (${res.status}): ${message}`);
  }

  return data;
}

export async function listProjects(search = "") {
  const data = await vercelFetch(
    `/v9/projects${search ? `?search=${encodeURIComponent(search)}` : ""}`
  );
  return data.projects ?? [];
}

export async function getProject(idOrName, teamId) {
  return vercelFetch(`/v9/projects/${encodeURIComponent(idOrName)}`, { teamId });
}

export async function renameProject(idOrName, newName, teamId) {
  return vercelFetch(`/v9/projects/${encodeURIComponent(idOrName)}`, {
    method: "PATCH",
    body: { name: newName },
    teamId,
  });
}

export async function deleteProject(idOrName, teamId) {
  return vercelFetch(`/v9/projects/${encodeURIComponent(idOrName)}`, {
    method: "DELETE",
    teamId,
  });
}

export async function createProject(name, { teamId, gitRepo } = {}) {
  const body = { name };
  if (gitRepo) {
    body.gitRepository = { type: "github", repo: gitRepo };
  }
  return vercelFetch("/v11/projects", {
    method: "POST",
    body,
    teamId,
  });
}

export async function listEnvVars(projectIdOrName, teamId) {
  const data = await vercelFetch(
    `/v10/projects/${encodeURIComponent(projectIdOrName)}/env`,
    { teamId }
  );
  return data.envs ?? [];
}

export async function upsertEnvVar(projectIdOrName, { key, value, type, targets }, teamId) {
  const envs = await listEnvVars(projectIdOrName, teamId);
  const existing = envs.find((env) => env.key === key);

  const payload = {
    key,
    value,
    type: type ?? (key.match(/SECRET|KEY|TOKEN|PASSWORD/i) ? "encrypted" : "plain"),
    target: targets ?? ["production", "preview", "development"],
  };

  if (existing) {
    return vercelFetch(
      `/v9/projects/${encodeURIComponent(projectIdOrName)}/env/${existing.id}`,
      { method: "PATCH", body: payload, teamId }
    );
  }

  return vercelFetch(`/v10/projects/${encodeURIComponent(projectIdOrName)}/env`, {
    method: "POST",
    body: payload,
    teamId,
  });
}

export function findProject(projects, names) {
  const wanted = names.map((n) => n.toLowerCase());
  return (
    projects.find((p) => wanted.includes(p.name?.toLowerCase())) ??
    projects.find((p) =>
      wanted.some((name) => p.name?.toLowerCase().includes(name))
    ) ??
    null
  );
}

export function projectUrl(project) {
  const alias = project?.alias?.[0]?.domain;
  if (alias) return `https://${alias}`;
  if (project?.name) return `https://${project.name}.vercel.app`;
  return null;
}
