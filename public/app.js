const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatMessage = document.getElementById("chatMessage");
const authArea = document.getElementById("authArea");
const openAuthBtn = document.getElementById("openAuthBtn");
const authModal = document.getElementById("authModal");
const closeAuthModal = document.getElementById("closeAuthModal");
const authTabSignIn = document.getElementById("authTabSignIn");
const authTabSignUp = document.getElementById("authTabSignUp");
const signInForm = document.getElementById("signInForm");
const signUpForm = document.getElementById("signUpForm");
const signInLogin = document.getElementById("signInLogin");
const signInPassword = document.getElementById("signInPassword");
const signInError = document.getElementById("signInError");
const signUpEmail = document.getElementById("signUpEmail");
const signUpUsername = document.getElementById("signUpUsername");
const signUpPassword = document.getElementById("signUpPassword");
const signUpError = document.getElementById("signUpError");
const planModal = document.getElementById("planModal");
const planSummary = document.getElementById("planSummary");
const exportBtn = document.getElementById("exportBtn");
const copyCsvBtn = document.getElementById("copyCsvBtn");
const dismissPlan = document.getElementById("dismissPlan");
const exportResult = document.getElementById("exportResult");
const playlistList = document.getElementById("playlistList");
const refreshPlaylists = document.getElementById("refreshPlaylists");
const creditsPanel = document.getElementById("creditsPanel");
const connectionsPanel = document.getElementById("connectionsPanel");
const toast = document.getElementById("toast");
const app = document.getElementById("app");
const chatLock = document.getElementById("chatLock");
const chatShell = document.getElementById("chatShell");
const chatLockSignInBtn = document.getElementById("chatLockSignInBtn");
const headerCreditsBtn = document.getElementById("headerCreditsBtn");
const chatSubmitBtn = chatForm.querySelector('button[type="submit"]');

let messages = [];
let currentPlan = null;
let lastExportCsv = "";
let authenticated = false;
let chatStarted = false;
let creditStatus = null;
let currentUser = null;

function showToast(text, isError = false) {
  toast.textContent = text;
  toast.classList.toggle("error", isError);
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), isError ? 12000 : 4000);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
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

function openAuthModal(mode = "signin") {
  authModal.classList.remove("hidden");
  showAuthTab(mode);
}

function closeAuthModalPanel() {
  authModal.classList.add("hidden");
  signInError.classList.add("hidden");
  signUpError.classList.add("hidden");
}

function showAuthTab(mode) {
  const isSignIn = mode === "signin";
  authTabSignIn.classList.toggle("active", isSignIn);
  authTabSignUp.classList.toggle("active", !isSignIn);
  signInForm.classList.toggle("hidden", !isSignIn);
  signUpForm.classList.toggle("hidden", isSignIn);
  document.getElementById("authModalTitle").textContent = isSignIn
    ? "Sign in"
    : "Create account";
}

function openCreditsPanel() {
  document.querySelector('.tool-btn[data-panel="credits"]')?.click();
}

function openConnectionsPanel() {
  document.querySelector('.tool-btn[data-panel="connections"]')?.click();
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
        <button class="btn btn-ghost" id="logoutBtn" type="button">Log out</button>
      </div>`;
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("creditBadgeBtn")?.addEventListener("click", openCreditsPanel);
  } else {
    authArea.innerHTML = `<button class="btn btn-primary" id="openAuthBtn" type="button">Sign in</button>`;
    document.getElementById("openAuthBtn").addEventListener("click", () => openAuthModal("signin"));
  }
}

async function checkAuth() {
  try {
    const data = await api("/api/auth/status");
    authenticated = data.authenticated;
    creditStatus = data.credits ?? null;
    currentUser = data.authenticated ? data.user : null;
    renderAuth(currentUser, creditStatus);
    updateChatLock();
    return data.authenticated;
  } catch {
    authenticated = false;
    creditStatus = null;
    currentUser = null;
    renderAuth(null, null);
    updateChatLock();
    return false;
  }
}

function updateChatLock() {
  if (authenticated) {
    chatLock.classList.add("hidden");
  } else {
    chatLock.classList.remove("hidden");
  }
}

async function loadCredits() {
  if (!authenticated) {
    creditsPanel.innerHTML = '<p class="muted">Sign in to view your credit balance.</p>';
    return;
  }

  creditsPanel.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const data = await api("/api/credits");
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
        <span>Save & export: ${data.costs.exportPlaylist} credits</span>
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
  }

  creditsPanel.querySelectorAll(".buy-tier-btn").forEach((btn) => {
    btn.addEventListener("click", () => startCheckout(btn.dataset.tier));
  });
}

async function startCheckout(tierId) {
  try {
    const data = await api("/api/credits", {
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
    /* still lock locally */
  }
  authenticated = false;
  creditStatus = null;
  currentUser = null;
  renderAuth(null, null);
  lockChat();
  showToast("Logged out");
}

function lockChat() {
  chatShell.classList.add("is-locked");
  chatMessage.disabled = true;
  chatSubmitBtn.disabled = true;
  messages = [];
  chatStarted = false;
  chatLog.innerHTML = "";
  currentPlan = null;
  planModal.classList.add("hidden");
  updateChatLock();
}

async function unlockAndStartChat() {
  chatShell.classList.remove("is-locked");
  chatMessage.disabled = false;
  chatSubmitBtn.disabled = false;
  updateChatLock();
  await startChat();
}

async function syncChatWithAuth(isAuthed) {
  if (isAuthed) {
    await unlockAndStartChat();
  } else {
    lockChat();
  }
}

function addMessage(role, text) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function startChat() {
  if (chatStarted) return;
  chatStarted = true;
  addMessage("system", "Starting session…");

  messages = [
    {
      role: "user",
      content:
        "Start the session. Ask what kind of playlist they want and what vibe they're going for.",
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
    showToast("Sign in first", true);
    openAuthModal("signin");
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
  exportResult.classList.add("hidden");
  planModal.classList.remove("hidden");
}

async function runExport() {
  if (!authenticated || !currentPlan) return;

  exportBtn.disabled = true;
  copyCsvBtn.disabled = true;

  try {
    const data = await api("/api/export", {
      method: "POST",
      body: JSON.stringify({ plan: currentPlan }),
    });

    lastExportCsv = data.csv;
    const lines = [
      `Saved "${data.playlist?.name || currentPlan.playlist?.name}"`,
      `${currentPlan.tracks?.length ?? 0} tracks`,
    ];
    exportResult.innerHTML = lines.map((l) => escapeHtml(l)).join("<br>");
    exportResult.classList.remove("hidden");
    showToast("Playlist saved!");
    planModal.classList.add("hidden");
    updateCreditsFromResponse(data);
  } catch (err) {
    if (handleInsufficientCredits(err)) return;
    showToast(err.message, true);
  } finally {
    exportBtn.disabled = false;
    copyCsvBtn.disabled = false;
  }
}

function planToCsv(plan) {
  const header = "artist,title";
  const rows = (plan.tracks || []).map((t) => {
    const artist = `"${String(t.artist).replace(/"/g, '""')}"`;
    const title = `"${String(t.title).replace(/"/g, '""')}"`;
    return `${artist},${title}`;
  });
  return [header, ...rows].join("\n");
}

async function copyCsv() {
  if (!currentPlan) return;
  try {
    const csv = lastExportCsv || planToCsv(currentPlan);
    await navigator.clipboard.writeText(csv);
    showToast("CSV copied to clipboard");
  } catch (err) {
    showToast(err.message, true);
  }
}

async function loadConnections() {
  if (!authenticated) {
    connectionsPanel.innerHTML =
      '<p class="muted">Sign in to manage your connected music services.</p>';
    return;
  }

  connectionsPanel.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const data = await api("/api/connections");
    renderConnectionsPanel(data.connections || []);
  } catch (err) {
    connectionsPanel.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
}

function renderConnectionsPanel(connections) {
  const cards = connections
    .map((connection) => {
      const status = connection.connected
        ? `<span class="connection-status connected">Connected${connection.displayName ? ` as ${escapeHtml(connection.displayName)}` : ""}</span>`
        : '<span class="connection-status">Not connected</span>';

      const connectClass =
        connection.provider === "youtube"
          ? "btn btn-youtube"
          : connection.provider === "soundcloud"
            ? "btn btn-soundcloud"
            : "btn btn-primary";

      const action = connection.connected
        ? `<button class="btn btn-ghost disconnect-btn" data-provider="${connection.provider}" type="button">Disconnect</button>`
        : connection.available
          ? `<button class="${connectClass} connect-btn" data-provider="${connection.provider}" type="button">Connect</button>`
          : `<span class="muted coming-soon">Coming soon</span>`;

      return `
        <div class="connection-card">
          <div class="connection-head">
            <div class="connection-icon" aria-hidden="true">${connection.icon}</div>
            <div>
              <h3>${escapeHtml(connection.name)}</h3>
              <p class="muted">${escapeHtml(connection.description)}</p>
            </div>
          </div>
          <div class="connection-body">
            ${status}
            ${action}
          </div>
        </div>`;
    })
    .join("");

  connectionsPanel.innerHTML = `
    <p class="connections-intro muted">Link a music service to apply playlists directly from Mixly. Export still works without connections.</p>
    <div class="connections-list">${cards}</div>`;

  connectionsPanel.querySelectorAll(".connect-btn").forEach((btn) => {
    btn.addEventListener("click", () => connectProvider(btn.dataset.provider));
  });

  connectionsPanel.querySelectorAll(".disconnect-btn").forEach((btn) => {
    btn.addEventListener("click", () => disconnectProvider(btn.dataset.provider));
  });
}

async function connectProvider(provider) {
  try {
    await api("/api/connections", {
      method: "POST",
      body: JSON.stringify({ action: "connect", provider }),
    });
    showToast("Connected!");
    await loadConnections();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function disconnectProvider(provider) {
  try {
    await api("/api/connections", {
      method: "POST",
      body: JSON.stringify({ action: "disconnect", provider }),
    });
    showToast("Disconnected");
    await loadConnections();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function loadPlaylists() {
  if (!authenticated) {
    playlistList.innerHTML = '<p class="muted">Sign in to see your saved playlists.</p>';
    return;
  }

  playlistList.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const data = await api("/api/playlists");
    if (!data.playlists.length) {
      playlistList.innerHTML =
        '<p class="muted">No saved playlists yet. Build one in Chat Curator.</p>';
      return;
    }
    playlistList.innerHTML = data.playlists
      .map(
        (p) => `
      <div class="playlist-item">
        <strong>${escapeHtml(p.name)}</strong>
        <div class="muted">${p.tracks} tracks${p.description ? ` · ${escapeHtml(p.description)}` : ""}</div>
        <button class="btn btn-ghost copy-playlist-btn" data-id="${p.id}" type="button">Copy CSV</button>
      </div>`
      )
      .join("");

    playlistList.querySelectorAll(".copy-playlist-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const playlist = data.playlists.find((p) => p.id === btn.dataset.id);
        if (!playlist?.tracksJson) return;
        const csv = ["artist,title", ...playlist.tracksJson.map((t) => {
          const artist = `"${String(t.artist).replace(/"/g, '""')}"`;
          const title = `"${String(t.title).replace(/"/g, '""')}"`;
          return `${artist},${title}`;
        })].join("\n");
        await navigator.clipboard.writeText(csv);
        showToast("CSV copied");
      });
    });
  } catch (err) {
    playlistList.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
}

async function handleSignIn(e) {
  e.preventDefault();
  signInError.classList.add("hidden");
  try {
    const data = await api("/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({
        login: signInLogin.value.trim(),
        password: signInPassword.value,
      }),
    });
    authenticated = true;
    currentUser = data.user;
    closeAuthModalPanel();
    signInForm.reset();
    await checkAuth();
    await syncChatWithAuth(authenticated);
    showToast("Signed in");
  } catch (err) {
    signInError.textContent = err.message;
    signInError.classList.remove("hidden");
  }
}

async function handleSignUp(e) {
  e.preventDefault();
  signUpError.classList.add("hidden");
  try {
    const data = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: signUpEmail.value.trim(),
        username: signUpUsername.value.trim(),
        password: signUpPassword.value,
      }),
    });
    authenticated = true;
    currentUser = data.user;
    closeAuthModalPanel();
    signUpForm.reset();
    await checkAuth();
    await syncChatWithAuth(authenticated);
    showToast("Account created");
  } catch (err) {
    signUpError.textContent = err.message;
    signUpError.classList.remove("hidden");
  }
}

document.querySelectorAll(".tool-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.panel}`).classList.add("active");
    if (btn.dataset.panel === "playlists") loadPlaylists();
    if (btn.dataset.panel === "connections") loadConnections();
    if (btn.dataset.panel === "credits") loadCredits();
  });
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!authenticated) {
    showToast("Sign in first", true);
    openAuthModal("signin");
    return;
  }
  const text = chatMessage.value.trim();
  if (!text) return;
  chatMessage.value = "";
  sendMessage(text);
});

exportBtn.addEventListener("click", runExport);
copyCsvBtn.addEventListener("click", copyCsv);
dismissPlan.addEventListener("click", () => planModal.classList.add("hidden"));
refreshPlaylists.addEventListener("click", loadPlaylists);

headerCreditsBtn?.addEventListener("click", () => {
  if (!authenticated) {
    showToast("Sign in to view credits", true);
    openAuthModal("signin");
    return;
  }
  openCreditsPanel();
});

openAuthBtn?.addEventListener("click", () => openAuthModal("signin"));
closeAuthModal?.addEventListener("click", closeAuthModalPanel);
authTabSignIn?.addEventListener("click", () => showAuthTab("signin"));
authTabSignUp?.addEventListener("click", () => showAuthTab("signup"));
signInForm?.addEventListener("submit", handleSignIn);
signUpForm?.addEventListener("submit", handleSignUp);
chatLockSignInBtn?.addEventListener("click", () => openAuthModal("signin"));
authModal?.addEventListener("click", (e) => {
  if (e.target === authModal) closeAuthModalPanel();
});

(async function init() {
  if (new URLSearchParams(window.location.search).get("purchase") === "success") {
    showToast("Purchase complete! Your credits are updating.");
    openCreditsPanel();
  }

  app.classList.remove("hidden");
  await checkAuth();
  await syncChatWithAuth(authenticated);
})();
