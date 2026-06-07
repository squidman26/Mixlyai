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
const refreshCredits = document.getElementById("refreshCredits");
const creditsPanel = document.getElementById("creditsPanel");
const toast = document.getElementById("toast");
const gate = document.getElementById("gate");
const app = document.getElementById("app");
const gateForm = document.getElementById("gateForm");
const gateCode = document.getElementById("gateCode");
const gateError = document.getElementById("gateError");
const chatLock = document.getElementById("chatLock");
const chatShell = document.getElementById("chatShell");
const chatLockLoginBtn = document.getElementById("chatLockLoginBtn");
const headerCreditsBtn = document.getElementById("headerCreditsBtn");
const chatSubmitBtn = chatForm.querySelector('button[type="submit"]');

let messages = [];
let currentPlan = null;
let authenticated = false;
let chatStarted = false;
let canonicalBaseUrl = null;
let creditStatus = null;
let currentUser = null;

function isPreviewHost() {
  const origin = window.location.origin;
  if (canonicalBaseUrl) {
    try {
      return new URL(origin).origin !== new URL(canonicalBaseUrl).origin;
    } catch {
      return false;
    }
  }
  const host = window.location.hostname;
  return host.endsWith(".vercel.app") && host !== "spotifybot-eight.vercel.app";
}

function spotifyLoginUrl() {
  if (isPreviewHost() && canonicalBaseUrl) {
    return `${canonicalBaseUrl}/api/auth/login`;
  }
  return "/api/auth/login";
}

function goToSpotifyLogin() {
  window.location.href = spotifyLoginUrl();
}

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

function openCreditsPanel() {
  const creditsBtn = document.querySelector('.tool-btn[data-panel="credits"]');
  creditsBtn?.click();
}

function renderAuth(user, credits) {
  if (user) {
    const creditBadge = credits?.unlimited
      ? '<span class="credits-badge credits-badge-btn" id="creditBadgeBtn">Unlimited credits</span>'
      : credits
        ? `<span class="credits-badge credits-badge-btn" id="creditBadgeBtn">${credits.credits} credits</span>`
        : "";
    authArea.innerHTML = `
      <div class="user-chip">
        <span>${escapeHtml(user.name)}</span>
        ${creditBadge}
        ${user.product === "premium" ? '<span class="badge">Premium</span>' : ""}
        <button class="btn btn-ghost" id="logoutBtn" type="button">Log out</button>
      </div>`;
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("creditBadgeBtn")?.addEventListener("click", openCreditsPanel);
  } else {
    authArea.innerHTML = `<button class="btn btn-spotify" id="loginBtn" type="button">Connect Spotify</button>`;
    document.getElementById("loginBtn").addEventListener("click", goToSpotifyLogin);
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
    creditStatus = data.credits ?? null;
    currentUser = data.authenticated ? data.user : null;
    renderAuth(currentUser, creditStatus);
    return data.authenticated;
  } catch {
    authenticated = false;
    creditStatus = null;
    currentUser = null;
    renderAuth(null, null);
    return false;
  }
}

async function loadCredits() {
  if (!authenticated) {
    creditsPanel.innerHTML = '<p class="muted">Connect Spotify to view your credit balance.</p>';
    return;
  }

  creditsPanel.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const data = await api("/api/credits/status");
    creditStatus = data;
    renderAuth(currentUser, creditStatus);
    renderCreditsPanel(data);
  } catch (err) {
    creditsPanel.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
}

function renderCreditsPanel(data) {
  const balanceText = data.unlimited
    ? "Unlimited"
    : `${data.credits} credits remaining`;

  const tierCards = (data.tiers || [])
    .map((tier) => {
      const isCurrent = tier.id === data.tier;
      const isPaid = tier.id !== "free";
      const action =
        data.unlimited || isCurrent
          ? `<span class="muted">${isCurrent ? "Current plan" : "Included"}</span>`
          : isPaid && data.squareConfigured
            ? `<button class="btn btn-primary buy-tier-btn" data-tier="${tier.id}" type="button">Buy with Square</button>`
            : isPaid
              ? `<span class="muted">Square checkout unavailable</span>`
              : `<span class="muted">Default plan</span>`;

      return `
        <div class="tier-card${isCurrent ? " current" : ""}">
          <h4>${escapeHtml(tier.name)}</h4>
          <div class="tier-price">${escapeHtml(tier.priceLabel)}</div>
          <div class="muted">${tier.credits.toLocaleString()} credits</div>
          ${action}
        </div>`;
    })
    .join("");

  creditsPanel.innerHTML = `
    <div class="credits-summary">
      <h3>${escapeHtml(data.tierName)} plan</h3>
      <div class="credits-balance">${escapeHtml(balanceText)}</div>
      <p class="muted">${data.unlimited ? "This account has unlimited credits." : `${data.tierCredits.toLocaleString()} credits included on this tier.`}</p>
      <div class="credits-costs">
        <span>Chat message: ${data.costs.chatMessage} credit</span>
        <span>Apply playlist: ${data.costs.applyPlaylist} credits</span>
        <span>Dry run: free</span>
      </div>
    </div>
    <div class="tier-grid">${tierCards}</div>
    <p class="credits-note">Paid plans are processed securely through Square. Credits refresh to your tier allowance after purchase.</p>
    <div class="credit-history" id="creditHistory"></div>`;

  const history = document.getElementById("creditHistory");
  if (data.transactions?.length) {
    history.innerHTML = `
      <h4>Recent activity</h4>
      <div class="credit-history-list">
        ${data.transactions
          .map((tx) => {
            const sign = tx.amount >= 0 ? "+" : "";
            const label = tx.reason.replaceAll("_", " ");
            return `<div class="credit-history-item">
              <span>${escapeHtml(label)}</span>
              <span>${sign}${tx.amount}${tx.balance_after != null ? ` · ${tx.balance_after} left` : ""}</span>
            </div>`;
          })
          .join("")}
      </div>`;
  } else {
    history.innerHTML = "";
  }

  creditsPanel.querySelectorAll(".buy-tier-btn").forEach((btn) => {
    btn.addEventListener("click", () => startCheckout(btn.dataset.tier));
  });
}

async function startCheckout(tierId) {
  try {
    const data = await api("/api/credits/checkout", {
      method: "POST",
      body: JSON.stringify({ tier: tierId }),
    });
    window.location.href = data.url;
  } catch (err) {
    showToast(err.message, true);
  }
}

function updateCreditsFromResponse(data) {
  if (!creditStatus || data.unlimitedCredits || data.credits == null) return;
  creditStatus = { ...creditStatus, credits: data.credits };
  renderAuth(currentUser, creditStatus);
}

function handleInsufficientCredits(err) {
  if (!/insufficient credits/i.test(err.message)) return false;
  showToast("You are out of credits. Open Credits to upgrade.", true);
  openCreditsPanel();
  loadCredits();
  return true;
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    /* still lock locally if the server request fails */
  }
  authenticated = false;
  creditStatus = null;
  renderAuth(null, null);
  lockChat();
  showToast("Logged out");
}

function lockChat() {
  chatShell.classList.add("is-locked");
  chatLock.classList.remove("hidden");
  chatMessage.disabled = true;
  chatSubmitBtn.disabled = true;
  messages = [];
  chatStarted = false;
  chatLog.innerHTML = "";
  currentPlan = null;
  planModal.classList.add("hidden");
}

async function unlockAndStartChat() {
  chatShell.classList.remove("is-locked");
  chatLock.classList.add("hidden");
  chatMessage.disabled = false;
  chatSubmitBtn.disabled = false;
  await startChat();
}

async function syncChatWithAuth(isAuthed) {
  if (isAuthed) {
    await unlockAndStartChat();
  } else {
    lockChat();
  }
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
    updateCreditsFromResponse(data);
  } catch (err) {
    if (/connect spotify/i.test(err.message)) {
      authenticated = false;
      chatStarted = false;
      lockChat();
      renderAuth(null, null);
      showToast(err.message, true);
      return;
    }
    if (handleInsufficientCredits(err)) {
      chatStarted = false;
      return;
    }
    chatLog.querySelector(".msg.system")?.remove();
    addMessage("system", `Error: ${err.message}`);
  }
}

async function sendMessage(text) {
  if (!authenticated) {
    showToast("Connect Spotify first", true);
    return;
  }

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
    updateCreditsFromResponse(data);
  } catch (err) {
    if (/connect spotify/i.test(err.message)) {
      authenticated = false;
      lockChat();
      renderAuth(null, null);
      showToast(err.message, true);
      return;
    }
    if (handleInsufficientCredits(err)) return;
    addMessage("system", `Error: ${err.message}`);
  } finally {
    if (authenticated) {
      chatMessage.disabled = false;
      chatMessage.focus();
    }
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
    updateCreditsFromResponse(data);
  } catch (err) {
    if (handleInsufficientCredits(err)) return;
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
    if (btn.dataset.panel === "credits") loadCredits();
  });
});

refreshCredits?.addEventListener("click", loadCredits);

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!authenticated) {
    showToast("Connect Spotify first", true);
    return;
  }
  const text = chatMessage.value.trim();
  if (!text) return;
  chatMessage.value = "";
  sendMessage(text);
});

applyBtn.addEventListener("click", () => runApply(false));
dryRunBtn.addEventListener("click", () => runApply(true));
dismissPlan.addEventListener("click", () => planModal.classList.add("hidden"));
refreshPlaylists.addEventListener("click", loadPlaylists);

headerCreditsBtn?.addEventListener("click", () => {
  if (!authenticated) {
    showToast("Connect Spotify first to view credits", true);
    return;
  }
  openCreditsPanel();
});

loginBtn?.addEventListener("click", goToSpotifyLogin);
chatLockLoginBtn?.addEventListener("click", goToSpotifyLogin);

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
    await syncChatWithAuth(authenticated);
  } catch (err) {
    gateError.textContent = err.message || "Invalid access code";
    gateError.classList.remove("hidden");
  }
});

(async function init() {
  const params = new URLSearchParams(window.location.search);
  const isOAuthReturn = params.has("auth") || params.has("auth_error");

  try {
    const info = await api("/api/auth/info");
    canonicalBaseUrl = info.canonicalBaseUrl || null;
  } catch {
    canonicalBaseUrl = null;
  }

  if (
    isPreviewHost() &&
    canonicalBaseUrl &&
    (params.has("auth") || params.has("auth_error") || params.has("code"))
  ) {
    window.location.replace(`${canonicalBaseUrl}/?${params}`);
    return;
  }

  if (params.get("auth") === "success") showToast("Spotify connected!");
  if (params.get("purchase") === "success") {
    showToast(`Purchase complete! Your credits are updating.`);
    openCreditsPanel();
  }
  if (params.get("supabase_error")) {
    showToast(`Spotify connected, but account sync failed: ${params.get("supabase_error")}`, true);
  }
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
    await syncChatWithAuth(authenticated);
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

  if (isPreviewHost() && canonicalBaseUrl) {
    showToast("Spotify login uses the production site.", false);
  }

  await checkAuth();
  await syncChatWithAuth(authenticated);
})();
