const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatMessage = document.getElementById("chatMessage");
const authArea = document.getElementById("authArea");
const openAuthBtn = document.getElementById("openAuthBtn");
const authModal = document.getElementById("authModal");
const authCloseBtn = document.getElementById("authCloseBtn");
const authTabSignin = document.getElementById("authTabSignin");
const authTabSignup = document.getElementById("authTabSignup");
const signinForm = document.getElementById("signinForm");
const signupForm = document.getElementById("signupForm");
const authError = document.getElementById("authError");
const connectSpotifyBtn = document.getElementById("connectSpotifyBtn");
const importCsvFile = document.getElementById("importCsvFile");
const importCsvText = document.getElementById("importCsvText");
const importPlaylistName = document.getElementById("importPlaylistName");
const importIncludeAmbiguous = document.getElementById("importIncludeAmbiguous");
const importRunBtn = document.getElementById("importRunBtn");
const importDryRunBtn = document.getElementById("importDryRunBtn");
const importResult = document.getElementById("importResult");
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
const chatLockLoginBtn = document.getElementById("chatLockLoginBtn");
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

function showAuthModal(mode = "signin") {
  authModal.classList.remove("hidden");
  authError.classList.add("hidden");
  setAuthTab(mode);
}

function hideAuthModal() {
  authModal.classList.add("hidden");
  authError.classList.add("hidden");
}

function setAuthTab(mode) {
  const signin = mode === "signin";
  authTabSignin.classList.toggle("active", signin);
  authTabSignup.classList.toggle("active", !signin);
  signinForm.classList.toggle("hidden", !signin);
  signupForm.classList.toggle("hidden", signin);
  document.getElementById("authModalTitle").textContent = signin
    ? "Sign in"
    : "Create account";
}

function showAuthError(message) {
  authError.textContent = message;
  authError.classList.remove("hidden");
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function updateApplyButtonLabel() {
  applyBtn.textContent = spotifyConnected ? "Apply to Spotify" : "Export CSV";
}

function isAllowlistAuthError(code) {
  return /spotify_not_allowlisted|not registered|not approved/i.test(code || "");
}

function showAllowlistHelp() {
  showToast(
    "Spotify connect is limited to 5 allowlisted users in Development Mode. CSV export works without Spotify.",
    true
  );
}

function hideAllowlistHelp() {}

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
    const spotifyBadge = spotifyConnected
      ? '<span class="badge">Spotify linked</span>'
      : '<button class="btn btn-spotify btn-small" id="headerSpotifyBtn" type="button">Connect Spotify</button>';
    authArea.innerHTML = `
      <div class="user-chip">
        <span>${escapeHtml(user.name)}</span>
        ${creditBadge}
        ${spotifyBadge}
        <button class="btn btn-ghost" id="logoutBtn" type="button">Log out</button>
      </div>`;
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("creditBadgeBtn")?.addEventListener("click", openCreditsPanel);
    document.getElementById("headerSpotifyBtn")?.addEventListener("click", goToSpotifyLogin);
  } else {
    authArea.innerHTML = `<button class="btn btn-primary" id="openAuthBtn" type="button">Sign in</button>`;
    document.getElementById("openAuthBtn").addEventListener("click", () => showAuthModal("signin"));
  }
  updateApplyButtonLabel();
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
    return data.authenticated;
  } catch {
    authenticated = false;
    spotifyConnected = false;
    creditStatus = null;
    currentUser = null;
    renderAuth(null, null);
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
    if (/sign in first/i.test(err.message)) {
      authenticated = false;
      chatStarted = false;
      lockChat();
      renderAuth(null, null);
      showAuthModal("signin");
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
    showAuthModal("signin");
    showToast("Sign in first", true);
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
    if (/sign in first/i.test(err.message)) {
      authenticated = false;
      lockChat();
      renderAuth(null, null);
      showAuthModal("signin");
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
    showAuthModal("signin");
    showToast("Sign in first", true);
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
    } else if (data.exportCsv) {
      lines.push("Matched tracks exported as CSV.");
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

    if (data.exportCsv) {
      const filename = `${(data.playlistName || currentPlan?.playlist?.name || "playlist").replace(/[^\w.-]+/g, "_")}.csv`;
      applyResult.innerHTML += `<br><button class="btn btn-ghost btn-small" id="downloadApplyCsv" type="button">Download CSV</button>`;
      document.getElementById("downloadApplyCsv")?.addEventListener("click", () => {
        downloadCsv(filename, data.exportCsv);
      });
      if (!dryRun) {
        downloadCsv(filename, data.exportCsv);
      }
    }

    applyResult.classList.remove("hidden");

    if (!dryRun && data.playlistUrl) {
      showToast("Playlist applied!");
      planModal.classList.add("hidden");
    } else if (!dryRun && data.exportCsv) {
      showToast("CSV exported!");
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
    playlistList.innerHTML = '<p class="muted">Sign in to see your playlists.</p>';
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

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!authenticated) {
    showAuthModal("signin");
    showToast("Sign in first", true);
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
    showAuthModal("signin");
    showToast("Sign in first to view credits", true);
    return;
  }
  openCreditsPanel();
});

openAuthBtn?.addEventListener("click", () => showAuthModal("signin"));
chatLockLoginBtn?.addEventListener("click", () => showAuthModal("signin"));
authCloseBtn?.addEventListener("click", hideAuthModal);
authTabSignin?.addEventListener("click", () => setAuthTab("signin"));
authTabSignup?.addEventListener("click", () => setAuthTab("signup"));
connectSpotifyBtn?.addEventListener("click", goToSpotifyLogin);

authModal?.addEventListener("click", (e) => {
  if (e.target === authModal) hideAuthModal();
});

signinForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  try {
    await api("/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({
        login: document.getElementById("signinLogin").value,
        password: document.getElementById("signinPassword").value,
      }),
    });
    hideAuthModal();
    await checkAuth();
    await syncChatWithAuth(authenticated);
    showToast("Signed in!");
  } catch (err) {
    showAuthError(err.message);
  }
});

signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  try {
    await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("signupEmail").value,
        username: document.getElementById("signupUsername").value,
        password: document.getElementById("signupPassword").value,
      }),
    });
    hideAuthModal();
    await checkAuth();
    await syncChatWithAuth(authenticated);
    showToast("Account created!");
  } catch (err) {
    showAuthError(err.message);
  }
});

importCsvFile?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  importCsvText.value = await file.text();
});

async function runCsvImport(dryRun) {
  if (!authenticated) {
    showAuthModal("signin");
    showToast("Sign in first", true);
    return;
  }

  const csv = importCsvText.value.trim();
  if (!csv) {
    showToast("Add a CSV file or paste CSV text", true);
    return;
  }

  importRunBtn.disabled = true;
  importDryRunBtn.disabled = true;
  importResult.classList.add("hidden");

  try {
    const data = await api("/api/import", {
      method: "POST",
      body: JSON.stringify({
        csv,
        playlistName: importPlaylistName.value.trim() || "Imported Playlist",
        includeAmbiguous: importIncludeAmbiguous.checked,
        dryRun,
      }),
    });

    const lines = [
      `Matched ${data.summary.matched.length} / ${data.summary.total} tracks`,
    ];
    if (data.summary.skipped.length) {
      lines.push(`Skipped ${data.summary.skipped.length} tracks`);
    }
    if (dryRun) {
      lines.push("Preview only — no credits used.");
    } else {
      lines.push("Export ready.");
    }

    importResult.innerHTML = `
      <p>${lines.map(escapeHtml).join("<br>")}</p>
      <button class="btn btn-primary btn-small" id="downloadImportCsv" type="button">Download CSV</button>`;
    importResult.classList.remove("hidden");
    document.getElementById("downloadImportCsv")?.addEventListener("click", () => {
      const filename = `${(data.playlistName || "imported_playlist").replace(/[^\w.-]+/g, "_")}.csv`;
      downloadCsv(filename, data.exportCsv);
    });

    if (!dryRun && data.exportCsv) {
      const filename = `${(data.playlistName || "imported_playlist").replace(/[^\w.-]+/g, "_")}.csv`;
      downloadCsv(filename, data.exportCsv);
    }

    updateCreditsFromResponse(data);
  } catch (err) {
    if (handleInsufficientCredits(err)) return;
    showToast(err.message, true);
  } finally {
    importRunBtn.disabled = false;
    importDryRunBtn.disabled = false;
  }
}

importRunBtn?.addEventListener("click", () => runCsvImport(false));
importDryRunBtn?.addEventListener("click", () => runCsvImport(true));

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

  if (params.get("auth") === "success") {
    hideAllowlistHelp();
    showToast("Spotify connected!");
    spotifyConnected = true;
  }
  if (params.get("purchase") === "success") {
    showToast(`Purchase complete! Your credits are updating.`);
    openCreditsPanel();
  }
  if (params.get("supabase_error")) {
    showToast(`Spotify connected, but account sync failed: ${params.get("supabase_error")}`, true);
  }
  if (params.get("auth_error")) {
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
    showToast("Spotify login uses the production site.", false);
  }

  await checkAuth();
  await syncChatWithAuth(authenticated);
})();
