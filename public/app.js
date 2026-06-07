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
const applyBtn = document.getElementById("applyBtn");
const dryRunBtn = document.getElementById("dryRunBtn");
const dismissPlan = document.getElementById("dismissPlan");
const applyResult = document.getElementById("applyResult");
const includeAmbiguous = document.getElementById("includeAmbiguous");
const playlistList = document.getElementById("playlistList");
const refreshPlaylists = document.getElementById("refreshPlaylists");
const creditsPanel = document.getElementById("creditsPanel");
const toast = document.getElementById("toast");
const gate = document.getElementById("gate");
const app = document.getElementById("app");
const gateForm = document.getElementById("gateForm");
const gateCode = document.getElementById("gateCode");
const gateError = document.getElementById("gateError");
const chatLock = document.getElementById("chatLock");
const chatShell = document.getElementById("chatShell");
const chatLockMessage = document.getElementById("chatLockMessage");
const chatLockSignInBtn = document.getElementById("chatLockSignInBtn");
const chatLockConnectBtn = document.getElementById("chatLockConnectBtn");
const connectionsPanel = document.getElementById("connectionsPanel");
const headerCreditsBtn = document.getElementById("headerCreditsBtn");
const authNotice = document.getElementById("authNotice");
const chatSubmitBtn = chatForm.querySelector('button[type="submit"]');

let messages = [];
let currentPlan = null;
let authenticated = false;
let spotifyConnected = false;
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

function hideAllowlistHelp() {}

function showAllowlistHelp() {}

function isAllowlistAuthError(code) {
  return (
    code === "spotify_not_allowlisted" ||
    /spotify_not_allowlisted|not registered|not approved/i.test(code)
  );
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

function openConnectionsPanel() {
  const connectionsBtn = document.querySelector('.tool-btn[data-panel="connections"]');
  connectionsBtn?.click();
}

function showToast(text, isError = false) {
  toast.textContent = text;
  toast.classList.toggle("error", isError);
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), isError ? 12000 : 4000);
}

function formatAuthError(code) {
  if (code === "spotify_not_allowlisted") {
    return (
      "This Spotify account is not allowlisted for the app. Add its email in Spotify Developer Dashboard → Users & Access, or apply for Extended Quota Mode."
    );
  }
  if (/spotify_not_allowlisted|not registered|not approved/i.test(code)) {
    return formatAuthError("spotify_not_allowlisted");
  }
  return `Auth failed: ${code}`;
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
    authArea.innerHTML = `<button class="btn btn-primary" id="openAuthBtn" type="button">Sign in</button>`;
    document.getElementById("openAuthBtn").addEventListener("click", () => openAuthModal("signin"));
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
    spotifyConnected = Boolean(data.spotifyConnected);
    creditStatus = data.credits ?? null;
    currentUser = data.authenticated ? data.user : null;
    renderAuth(currentUser, creditStatus);
    updateChatLock();
    return data.authenticated;
  } catch {
    authenticated = false;
    spotifyConnected = false;
    creditStatus = null;
    currentUser = null;
    renderAuth(null, null);
    updateChatLock();
    return false;
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
    /* still lock locally if the server request fails */
  }
  authenticated = false;
  spotifyConnected = false;
  creditStatus = null;
  currentUser = null;
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

function updateChatLock() {
  if (!authenticated) {
    chatLockMessage.textContent = "Sign in to chat with the playlist curator.";
    chatLockSignInBtn.classList.remove("hidden");
    chatLockConnectBtn.classList.add("hidden");
    return;
  }

  if (!spotifyConnected) {
    chatLockMessage.textContent =
      "Connect Spotify in Connections to chat with the playlist curator.";
    chatLockSignInBtn.classList.add("hidden");
    chatLockConnectBtn.classList.remove("hidden");
    return;
  }

  chatLockSignInBtn.classList.add("hidden");
  chatLockConnectBtn.classList.add("hidden");
}

async function syncChatWithAuth(isAuthed) {
  updateChatLock();
  if (isAuthed && spotifyConnected) {
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
      spotifyConnected = false;
      chatStarted = false;
      lockChat();
      updateChatLock();
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
    showToast("Sign in first", true);
    openAuthModal("signin");
    return;
  }
  if (!spotifyConnected) {
    showToast("Connect Spotify in Connections first", true);
    openConnectionsPanel();
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
      spotifyConnected = false;
      lockChat();
      updateChatLock();
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
    showToast("Sign in first", true);
    return;
  }
  if (!spotifyConnected) {
    showToast("Connect Spotify in Connections first", true);
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
    playlistList.innerHTML =
      '<p class="muted">Sign in to see your playlists.</p>';
    return;
  }
  if (!spotifyConnected) {
    playlistList.innerHTML =
      '<p class="muted">Connect Spotify in Connections to see your playlists.</p>';
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

async function loadConnections() {
  if (!authenticated) {
    connectionsPanel.innerHTML =
      '<p class="muted">Sign in to manage your connected services.</p>';
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
  const spotify = connections.find((c) => c.provider === "spotify") || {
    provider: "spotify",
    connected: false,
  };

  const status = spotify.connected
    ? `<span class="connection-status connected">Connected${spotify.name ? ` as ${escapeHtml(spotify.name)}` : ""}${spotify.product === "premium" ? ' <span class="badge">Premium</span>' : ""}</span>`
    : '<span class="connection-status">Not connected</span>';

  const action = spotify.connected
    ? `<button class="btn btn-ghost" id="disconnectSpotifyBtn" type="button">Disconnect</button>`
    : `<button class="btn btn-spotify" id="connectSpotifyBtn" type="button">Connect Spotify</button>`;

  connectionsPanel.innerHTML = `
    <div class="connection-card">
      <div class="connection-head">
        <div class="connection-icon" aria-hidden="true">🎵</div>
        <div>
          <h3>Spotify</h3>
          <p class="muted">Required for playlist curation and applying tracks.</p>
        </div>
      </div>
      <div class="connection-body">
        ${status}
        ${action}
      </div>
    </div>`;

  document
    .getElementById("connectSpotifyBtn")
    ?.addEventListener("click", goToSpotifyLogin);
  document
    .getElementById("disconnectSpotifyBtn")
    ?.addEventListener("click", disconnectSpotify);
}

async function disconnectSpotify() {
  try {
    await api("/api/connections", {
      method: "POST",
      body: JSON.stringify({ action: "disconnect", provider: "spotify" }),
    });
    spotifyConnected = false;
    lockChat();
    updateChatLock();
    showToast("Spotify disconnected");
    await loadConnections();
  } catch (err) {
    showToast(err.message, true);
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
    spotifyConnected = Boolean(data.spotifyConnected);
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
    spotifyConnected = false;
    currentUser = data.user;
    closeAuthModalPanel();
    signUpForm.reset();
    await checkAuth();
    await syncChatWithAuth(authenticated);
    showToast("Account created");
    openConnectionsPanel();
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
  if (!spotifyConnected) {
    showToast("Connect Spotify in Connections first", true);
    openConnectionsPanel();
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
chatLockConnectBtn?.addEventListener("click", openConnectionsPanel);

authModal?.addEventListener("click", (e) => {
  if (e.target === authModal) closeAuthModalPanel();
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
  const data = await api("/api/access");
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
    await api("/api/access", {
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

  if (params.get("auth_error") === "sign_in_first") {
    showToast("Sign in before connecting Spotify", true);
    openAuthModal("signin");
  }
  if (params.get("purchase") === "success") {
    showToast(`Purchase complete! Your credits are updating.`);
    openCreditsPanel();
  }
  if (params.get("supabase_error")) {
    showToast(`Spotify connected, but account sync failed: ${params.get("supabase_error")}`, true);
  }
  if (params.get("auth_error") && params.get("auth_error") !== "sign_in_first") {
    const authError = params.get("auth_error");
    showToast(formatAuthError(authError), true);
    if (isAllowlistAuthError(authError)) showAllowlistHelp();
  }

  if (isOAuthReturn) {
    const data = await api("/api/access");
    if (data.enabled && !data.unlocked) {
      showGate();
      return;
    }
    showApp();
    if (params.has("auth") || params.has("auth_error")) {
      history.replaceState({}, "", window.location.pathname);
    }
    await checkAuth();
    if (params.get("auth") === "success") {
      hideAllowlistHelp();
      showToast("Spotify connected!");
      openConnectionsPanel();
      await loadConnections();
    }
    await syncChatWithAuth(authenticated);
    return;
  }

  try {
    await fetch("/api/access", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
  } catch {
    /* ignore */
  }

  const unlocked = await requireGateOnVisit();
  if (!unlocked) return;

  if (isPreviewHost() && canonicalBaseUrl) {
    showToast("Spotify connections use the production site.", false);
  }

  await checkAuth();
  await syncChatWithAuth(authenticated);
})();
