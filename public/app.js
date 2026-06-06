const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatMessage = document.getElementById("chatMessage");
const authArea = document.getElementById("authArea");
const loginBtn = document.getElementById("loginBtn");
const planModal = document.getElementById("planModal");
const planSummary = document.getElementById("planSummary");
const applyBtn = document.getElementById("applyBtn");
const dryRunBtn = document.getElementById("dryRunBtn");
const dismissPlan = document.getElementById("dismissPlan");
const applyResult = document.getElementById("applyResult");
const includeAmbiguous = document.getElementById("includeAmbiguous");
const playlistList = document.getElementById("playlistList");
const refreshPlaylists = document.getElementById("refreshPlaylists");
const toast = document.getElementById("toast");
const gate = document.getElementById("gate");
const app = document.getElementById("app");
const gateForm = document.getElementById("gateForm");
const gateCode = document.getElementById("gateCode");
const gateError = document.getElementById("gateError");

let messages = [];
let currentPlan = null;
let authenticated = false;
let chatStarted = false;

function showToast(text, isError = false) {
  toast.textContent = text;
  toast.classList.toggle("error", isError);
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 4000);
}

function addMessage(role, text) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function renderAuth(user) {
  if (user) {
    authArea.innerHTML = `
      <div class="user-chip">
        <span>${escapeHtml(user.name)}</span>
        ${user.product === "premium" ? '<span class="badge">Premium</span>' : ""}
        <button class="btn btn-ghost" id="logoutBtn" type="button">Log out</button>
      </div>`;
    document.getElementById("logoutBtn").addEventListener("click", logout);
  } else {
    authArea.innerHTML = `<button class="btn btn-spotify" id="loginBtn" type="button">Connect Spotify</button>`;
    document.getElementById("loginBtn").addEventListener("click", () => {
      window.location.href = "/api/auth/login";
    });
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function checkAuth() {
  try {
    const data = await api("/api/auth/status");
    authenticated = data.authenticated;
    renderAuth(data.authenticated ? data.user : null);
    return data.authenticated;
  } catch {
    authenticated = false;
    renderAuth(null);
    return false;
  }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  authenticated = false;
  renderAuth(null);
  showToast("Logged out");
}

async function startChat() {
  if (chatStarted) return;
  chatStarted = true;
  addMessage("system", "Starting session…");

  messages = [
    {
      role: "user",
      content:
        "Start the session. Ask whether I want to create a new playlist or edit an existing one, and what vibe I'm going for.",
    },
  ];

  try {
    const data = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
    });
    messages.push({ role: "assistant", content: data.fullReply || data.reply });
    chatLog.querySelector(".msg.system")?.remove();
    addMessage("assistant", data.reply);
    if (data.plan) showPlan(data.plan);
  } catch (err) {
    addMessage("system", `Error: ${err.message}`);
  }
}

async function sendMessage(text) {
  messages.push({ role: "user", content: text });
  addMessage("user", text);
  chatMessage.disabled = true;

  try {
    const data = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
    });
    messages.push({ role: "assistant", content: data.fullReply || data.reply });
    if (data.reply) addMessage("assistant", data.reply);
    if (data.plan) showPlan(data.plan);
  } catch (err) {
    addMessage("system", `Error: ${err.message}`);
  } finally {
    chatMessage.disabled = false;
    chatMessage.focus();
  }
}

function showPlan(plan) {
  currentPlan = plan;
  planSummary.textContent = plan.summary;
  applyResult.classList.add("hidden");
  planModal.classList.remove("hidden");
}

async function runApply(dryRun) {
  if (!authenticated) {
    showToast("Connect Spotify first", true);
    return;
  }
  if (!currentPlan) return;

  applyBtn.disabled = true;
  dryRunBtn.disabled = true;

  try {
    const data = await api("/api/apply", {
      method: "POST",
      body: JSON.stringify({
        plan: currentPlan,
        dryRun,
        includeAmbiguous: includeAmbiguous.checked,
      }),
    });

    const lines = [
      `Matched ${data.summary.matched.length} / ${data.summary.total} tracks`,
    ];
    if (data.summary.skipped.length) {
      lines.push(`Skipped ${data.summary.skipped.length} tracks`);
    }
    if (data.playlistUrl) {
      lines.push(`Playlist: ${data.playlistName}`);
      lines.push(`URL: ${data.playlistUrl}`);
    } else if (dryRun) {
      lines.push("Dry run — no changes made.");
    }

    applyResult.innerHTML = lines
      .map((l) =>
        l.startsWith("URL:")
          ? `URL: <a href="${data.playlistUrl}" target="_blank" rel="noopener">${data.playlistUrl}</a>`
          : escapeHtml(l)
      )
      .join("<br>");
    applyResult.classList.remove("hidden");

    if (!dryRun && data.playlistUrl) {
      showToast("Playlist applied!");
      planModal.classList.add("hidden");
    }
  } catch (err) {
    showToast(err.message, true);
  } finally {
    applyBtn.disabled = false;
    dryRunBtn.disabled = false;
  }
}

async function loadPlaylists() {
  if (!authenticated) {
    playlistList.innerHTML = '<p class="muted">Connect Spotify to see your playlists.</p>';
    return;
  }

  playlistList.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const data = await api("/api/playlists");
    if (!data.playlists.length) {
      playlistList.innerHTML =
        '<p class="muted">No playlists created here yet. Build one in Chat Curator.</p>';
      return;
    }
    playlistList.innerHTML = data.playlists
      .map(
        (p) => `
      <div class="playlist-item">
        <strong>${escapeHtml(p.name)}</strong>
        <div class="muted">${p.tracks} tracks</div>
        <a href="${p.url}" target="_blank" rel="noopener">Open in Spotify</a>
      </div>`
      )
      .join("");
  } catch (err) {
    playlistList.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
}

document.querySelectorAll(".tool-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.panel}`).classList.add("active");
    if (btn.dataset.panel === "playlists") loadPlaylists();
  });
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatMessage.value.trim();
  if (!text) return;
  chatMessage.value = "";
  sendMessage(text);
});

applyBtn.addEventListener("click", () => runApply(false));
dryRunBtn.addEventListener("click", () => runApply(true));
dismissPlan.addEventListener("click", () => planModal.classList.add("hidden"));
refreshPlaylists.addEventListener("click", loadPlaylists);

loginBtn?.addEventListener("click", () => {
  window.location.href = "/api/auth/login";
});

function showApp() {
  gate.classList.add("hidden");
  app.classList.remove("hidden");
}

function showGate() {
  gate.classList.remove("hidden");
  app.classList.add("hidden");
}

async function requireGateOnVisit() {
  const data = await api("/api/access/status");
  if (!data.enabled) {
    showApp();
    return true;
  }
  showGate();
  return false;
}

gateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  gateError.classList.add("hidden");
  const code = gateCode.value.trim();
  if (!code) return;

  try {
    await api("/api/access/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    gateCode.value = "";
    showApp();
    await checkAuth();
    await startChat();
  } catch (err) {
    gateError.textContent = err.message || "Invalid access code";
    gateError.classList.remove("hidden");
  }
});

(async function init() {
  const params = new URLSearchParams(window.location.search);
  const isOAuthReturn = params.has("auth") || params.has("auth_error");

  if (params.get("auth") === "success") showToast("Spotify connected!");
  if (params.get("auth_error")) {
    showToast(`Auth failed: ${params.get("auth_error")}`, true);
  }

  if (isOAuthReturn) {
    const data = await api("/api/access/status");
    if (data.enabled && !data.unlocked) {
      showGate();
      return;
    }
    showApp();
    if (params.has("auth") || params.has("auth_error")) {
      history.replaceState({}, "", window.location.pathname);
    }
    await checkAuth();
    await startChat();
    return;
  }

  try {
    await fetch("/api/access/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    /* ignore */
  }

  const unlocked = await requireGateOnVisit();
  if (!unlocked) return;

  await checkAuth();
  await startChat();
})();
