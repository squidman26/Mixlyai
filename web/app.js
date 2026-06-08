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
const signInRemember = document.getElementById("signInRemember");
const signInError = document.getElementById("signInError");
const signUpEmail = document.getElementById("signUpEmail");
const signUpUsername = document.getElementById("signUpUsername");
const signUpPassword = document.getElementById("signUpPassword");
const signUpRemember = document.getElementById("signUpRemember");
const signUpError = document.getElementById("signUpError");

const REMEMBER_LOGIN_KEY = "mixly_remember_login";
const SAVED_LOGIN_KEY = "mixly_saved_login";
const ACCESS_CODE_KEY = "mixly_site_access_code";

let activeAccessCode = "";
const planModal = document.getElementById("planModal");
const planSummary = document.getElementById("planSummary");
const exportBtn = document.getElementById("exportBtn");
const applyYoutubeBtn = document.getElementById("applyYoutubeBtn");
const connectYoutubeBtn = document.getElementById("connectYoutubeBtn");
const copyCsvBtn = document.getElementById("copyCsvBtn");
const dismissPlan = document.getElementById("dismissPlan");
const exportResult = document.getElementById("exportResult");
const playlistList = document.getElementById("playlistList");
const refreshPlaylists = document.getElementById("refreshPlaylists");
const creditsPanel = document.getElementById("creditsPanel");
const connectionsPanel = document.getElementById("connectionsPanel");
const toast = document.getElementById("toast");
const gate = document.getElementById("gate");
const app = document.getElementById("app");
const gateForm = document.getElementById("gateForm");
const gateCode = document.getElementById("gateCode");
const gateError = document.getElementById("gateError");
const chatLock = document.getElementById("chatLock");
const chatShell = document.getElementById("chatShell");
const chatLockMessage = document.getElementById("chatLockMessage");
const chatLockActionBtn = document.getElementById("chatLockActionBtn");
const headerCreditsBtn = document.getElementById("headerCreditsBtn");
const chatSubmitBtn = chatForm.querySelector('button[type="submit"]');

let messages = [];
let currentPlan = null;
let lastExportCsv = "";
let authenticated = false;
let chatStarted = false;
let creditStatus = null;
let selectedPurchaseTier = null;
let lastCreditsPanelData = null;
let currentUser = null;
let youtubeConnected = false;
let chatLockAction = () => openAuthModal("signin");

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

function readAccessCodeFromStorage() {
  try {
    return sessionStorage.getItem(ACCESS_CODE_KEY) || "";
  } catch {
    return "";
  }
}

function getStoredAccessCode() {
  return activeAccessCode;
}

function setStoredAccessCode(code) {
  activeAccessCode = code || "";
  try {
    if (code) sessionStorage.setItem(ACCESS_CODE_KEY, code);
    else sessionStorage.removeItem(ACCESS_CODE_KEY);
  } catch {
    /* private browsing */
  }
}

activeAccessCode = readAccessCodeFromStorage();

async function api(path, options = {}) {
  const code = getStoredAccessCode();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (code) headers["X-Site-Access-Code"] = code;

  const res = await fetch(path, {
    credentials: "same-origin",
    headers,
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function loadSavedSignInPrefs() {
  try {
    const remember = localStorage.getItem(REMEMBER_LOGIN_KEY);
    if (remember != null && signInRemember) {
      signInRemember.checked = remember === "1";
    }
    const savedLogin = localStorage.getItem(SAVED_LOGIN_KEY);
    if (savedLogin && signInLogin && !signInLogin.value) {
      signInLogin.value = savedLogin;
    }
    if (signUpRemember) {
      signUpRemember.checked = signInRemember?.checked ?? true;
    }
  } catch {
    /* private browsing */
  }
}

function persistSignInPrefs(login, remember) {
  try {
    localStorage.setItem(REMEMBER_LOGIN_KEY, remember ? "1" : "0");
    if (remember && login) {
      localStorage.setItem(SAVED_LOGIN_KEY, login);
    } else {
      localStorage.removeItem(SAVED_LOGIN_KEY);
    }
  } catch {
    /* private browsing */
  }
}

function openAuthModal(mode = "signin") {
  authModal.classList.remove("hidden");
  loadSavedSignInPrefs();
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

function updateCreditsTabLabel(credits) {
  document.querySelectorAll('.tool-btn[data-panel="credits"] .tool-label').forEach((el) => {
    if (!el.dataset.defaultLabel) {
      el.dataset.defaultLabel = el.textContent;
    }
    el.textContent = credits?.unlimited
      ? "Unlimited"
      : el.dataset.defaultLabel;
  });
}

function formatRenewalDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isWaitingForPaidRenewal(credits) {
  return Boolean(credits?.waitingForRenewal);
}

function renderAuth(user, credits) {
  updateCreditsTabLabel(credits);

  if (user) {
    const planLabel = credits?.planLabel
      ? `<span class="user-plan-label">${escapeHtml(credits.planLabel)}</span>`
      : "";
    const creditBadge = credits?.unlimited
      ? '<span class="credits-badge credits-badge-btn" id="creditBadgeBtn">Unlimited</span>'
      : credits
        ? `<span class="credits-badge credits-badge-btn" id="creditBadgeBtn">${credits.credits} credits</span>`
        : "";
    authArea.innerHTML = `
      <div class="user-chip">
        <span class="user-name">${escapeHtml(user.name)}</span>
        ${planLabel}
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

async function refreshConnectionState() {
  if (!authenticated) {
    youtubeConnected = false;
    updatePlanActions();
    return;
  }

  try {
    const data = await api("/api/connections");
    const youtube = (data.connections || []).find(
      (connection) => connection.provider === "youtube"
    );
    youtubeConnected = Boolean(youtube?.connected && youtube?.available);
  } catch {
    youtubeConnected = false;
  }
  updatePlanActions();
}

function updatePlanActions() {
  applyYoutubeBtn?.classList.toggle("hidden", !youtubeConnected);
  connectYoutubeBtn?.classList.toggle(
    "hidden",
    !authenticated || youtubeConnected
  );
}

async function checkAuth() {
  try {
    const data = await api("/api/auth/status");
    authenticated = data.authenticated;
    creditStatus = data.credits ?? null;
    currentUser = data.authenticated ? data.user : null;
    renderAuth(currentUser, creditStatus);
    updateChatLock();
    await refreshConnectionState();
    return data.authenticated;
  } catch {
    authenticated = false;
    creditStatus = null;
    currentUser = null;
    youtubeConnected = false;
    renderAuth(null, null);
    updateChatLock();
    updatePlanActions();
    return false;
  }
}

function hasUsableCredits() {
  if (!creditStatus) return false;
  if (creditStatus.unlimited) return true;
  return (creditStatus.credits ?? 0) > 0;
}

function canUseChat() {
  return authenticated && hasUsableCredits();
}

function updateChatLock() {
  if (canUseChat()) {
    chatLock.classList.add("hidden");
    chatLockActionBtn.classList.remove("hidden");
    return;
  }

  chatLock.classList.remove("hidden");

  if (!authenticated) {
    chatLockMessage.textContent = "Sign in to chat with the playlist curator.";
    chatLockActionBtn.textContent = "Sign in or create account";
    chatLockActionBtn.classList.remove("hidden");
    chatLockAction = () => openAuthModal("signin");
  } else if (isWaitingForPaidRenewal(creditStatus)) {
    const renewDate = formatRenewalDate(creditStatus.creditsRenewAt);
    chatLockMessage.textContent = renewDate
      ? `You're out of credits. Your ${creditStatus.tierName} plan renews on ${renewDate}. Please wait until then to chat again.`
      : `You're out of credits. Your ${creditStatus.tierName} plan will renew soon. Please wait until your credits refresh to chat again.`;
    chatLockActionBtn.classList.add("hidden");
    chatLockAction = () => {};
  } else {
    chatLockMessage.textContent =
      "You are out of credits. Open Credits to upgrade or purchase more before chatting.";
    chatLockActionBtn.textContent = "Go to Credits";
    chatLockActionBtn.classList.remove("hidden");
    chatLockAction = openCreditsPanel;
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
    lastCreditsPanelData = data;
    renderAuth(currentUser, creditStatus);
    renderCreditsPanel();
    await syncChatAccess();
  } catch (err) {
    creditsPanel.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
}

function isPaidTier(tierId) {
  return tierId === "basic" || tierId === "pro";
}

function isTierSelectable(tier, data) {
  if (tier.id === "free") return false;
  if (tier.id === data.tier) return false;
  return isPaidTier(tier.id);
}

function getSelectedTier(data) {
  return (data.tiers || []).find((tier) => tier.id === selectedPurchaseTier) ?? null;
}

function shouldShowCheckout(data, tierId) {
  if (!tierId) return false;
  return isPaidTier(tierId);
}

function renderFreeTierCard(tier, data) {
  const isCurrent = tier.id === data.tier;
  const isSelected = tier.id === selectedPurchaseTier;
  const statusLabel = data.unlimited
    ? ""
    : isCurrent
      ? "Current plan"
      : "Starter";

  const cardBody = `
    <div class="tier-card-top">
      <h4>${escapeHtml(tier.name)}</h4>
      ${statusLabel ? `<span class="tier-status">${statusLabel}</span>` : ""}
    </div>
    <div class="tier-price">${escapeHtml(tier.priceLabel)}</div>
    <div class="tier-credits">${tier.credits.toLocaleString()} credits</div>
    ${isSelected ? '<span class="tier-selected-mark" aria-hidden="true">Selected</span>' : ""}`;

  return `
    <div class="tier-card tier-card--static${isCurrent ? " current" : ""} tier-card--free">
      ${cardBody}
    </div>`;
}

function renderPaidTierCard(tier, data) {
  const isCurrent = tier.id === data.tier;
  const isSelected = tier.id === selectedPurchaseTier;
  const selectable = isTierSelectable(tier, data);
  const statusLabel = data.unlimited
    ? ""
    : isCurrent
      ? "Current plan"
      : "Upgrade";

  const cardBody = `
    <div class="tier-card-top">
      <h4>${escapeHtml(tier.name)}</h4>
      ${statusLabel ? `<span class="tier-status">${statusLabel}</span>` : ""}
    </div>
    <div class="tier-price">${escapeHtml(tier.priceLabel)}</div>
    <div class="tier-credits">${tier.credits.toLocaleString()} credits</div>
    ${isSelected ? '<span class="tier-selected-mark" aria-hidden="true">Selected</span>' : ""}`;

  if (!selectable) {
    return `
      <div class="tier-card tier-card--static${isCurrent ? " current" : ""}">
        ${cardBody}
      </div>`;
  }

  return `
    <button
      class="tier-card tier-select-btn${isSelected ? " selected" : ""}"
      data-tier="${tier.id}"
      type="button"
      aria-pressed="${isSelected}"
    >
      ${cardBody}
    </button>`;
}

function renderTierCard(tier, data) {
  if (tier.id === "free") {
    return renderFreeTierCard(tier, data);
  }
  return renderPaidTierCard(tier, data);
}

function renderCreditsCheckout(data) {
  const selected = getSelectedTier(data);
  if (!shouldShowCheckout(data, selected?.id) || !selected) {
    return `<div class="credits-checkout credits-checkout--hidden" id="creditsCheckout" hidden></div>`;
  }

  const squareReady = Boolean(data.squareConfigured);

  return `
    <div class="credits-checkout" id="creditsCheckout">
      <div class="credits-checkout-copy">
        <span class="credits-checkout-label">Selected plan</span>
        <strong>${escapeHtml(selected.name)} — ${escapeHtml(selected.priceLabel)}</strong>
        <span class="muted">${selected.credits.toLocaleString()} credits after purchase</span>
      </div>
      <div class="credits-checkout-action">
        <button
          class="btn btn-primary credits-pay-btn"
          id="payWithSquareBtn"
          type="button"
          ${squareReady ? "" : "disabled"}
        >
          Pay with Square
        </button>
        ${
          squareReady
            ? ""
            : '<p class="credits-checkout-message muted">Square checkout is unavailable right now.</p>'
        }
      </div>
    </div>`;
}

function setupCreditsPanelEvents() {
  if (!creditsPanel || creditsPanel.dataset.eventsBound) return;
  creditsPanel.dataset.eventsBound = "1";

  creditsPanel.addEventListener("click", (e) => {
    const tierBtn = e.target.closest(".tier-select-btn");
    if (tierBtn) {
      const tierId = tierBtn.dataset.tier;
      selectedPurchaseTier = selectedPurchaseTier === tierId ? null : tierId;
      renderCreditsPanel();
      if (selectedPurchaseTier) {
        requestAnimationFrame(() => {
          document
            .getElementById("creditsCheckout")
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
      return;
    }

    const payBtn = e.target.closest("#payWithSquareBtn");
    if (payBtn && !payBtn.disabled && selectedPurchaseTier) {
      startCheckout(selectedPurchaseTier);
    }
  });
}

function renderCreditsPanel() {
  const data = lastCreditsPanelData;
  if (!data) return;

  if (data.unlimited) {
    selectedPurchaseTier = null;
    creditsPanel.innerHTML = `
      <div class="credits-developer-panel">
        <div class="credits-developer-title">Unlimited</div>
        <p class="muted">Credit limits are bypassed on this account.</p>
      </div>`;
    return;
  }

  const balanceText = `${data.credits} credits remaining`;
  const renewalNote =
    isPaidTier(data.tier) && data.creditsRenewAt
      ? `<p class="credits-renewal muted">Credits renew on ${escapeHtml(formatRenewalDate(data.creditsRenewAt))}.</p>`
      : "";
  const outOfCreditsNote =
    isWaitingForPaidRenewal(data)
      ? `<p class="credits-waiting muted">You're out of credits. Chat unlocks when your plan renews on ${escapeHtml(formatRenewalDate(data.creditsRenewAt))}.</p>`
      : "";

  if (
    selectedPurchaseTier &&
    !(data.tiers || []).some((tier) => isTierSelectable(tier, data) && tier.id === selectedPurchaseTier)
  ) {
    selectedPurchaseTier = null;
  }

  const tierCards = (data.tiers || []).map((tier) => renderTierCard(tier, data)).join("");

  creditsPanel.innerHTML = `
    <div class="credits-summary">
      <h3>${escapeHtml(data.tierName)} plan</h3>
      <div class="credits-balance">${escapeHtml(balanceText)}</div>
      <p class="muted">${data.tierCredits.toLocaleString()} credits included on this tier.</p>
      ${renewalNote}
      ${outOfCreditsNote}
      <div class="credits-costs">
        <span>Chat: ${data.costs.chatMessage ? `${data.costs.chatMessage} credit` : "Free"}</span>
        <span>Save playlist: ${data.costs.exportPlaylist} credits</span>
      </div>
    </div>
    <div class="credits-plans">
      <h4 class="credits-plans-title">Choose a plan</h4>
      <p class="credits-plans-desc muted">Click Basic or Pro to select a plan. The Pay with Square button appears below.</p>
      <div class="tier-grid">${tierCards}</div>
    </div>
    ${renderCreditsCheckout(data)}
    <p class="credits-note">Credits refresh to your tier allowance after purchase. Your balance may take a short time to update while payment is confirmed.</p>
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

}

async function startCheckout(tierId) {
  const payBtn = document.getElementById("payWithSquareBtn");
  const payLabel = payBtn?.textContent || "Pay with Square";

  if (payBtn) {
    payBtn.disabled = true;
    payBtn.textContent = "Redirecting…";
  }

  try {
    const data = await api("/api/credits", {
      method: "POST",
      body: JSON.stringify({ tier: tierId }),
    });
    window.location.href = data.url;
  } catch (err) {
    showToast(err.message, true);
    if (payBtn) {
      payBtn.disabled = !lastCreditsPanelData?.squareConfigured;
      payBtn.textContent = payLabel;
    }
  }
}

function updateCreditsFromResponse(data) {
  if (!creditStatus || data.unlimitedCredits || data.credits == null) return;
  const credits = data.credits;
  creditStatus = {
    ...creditStatus,
    credits,
    waitingForRenewal:
      isPaidTier(creditStatus.tier) && credits <= 0 && Boolean(creditStatus.creditsRenewAt),
  };
  renderAuth(currentUser, creditStatus);
  syncChatAccess();
}

async function handleInsufficientCredits(err) {
  if (!/insufficient credits/i.test(err.message)) return false;
  if (creditStatus && !creditStatus.unlimited) {
    creditStatus = {
      ...creditStatus,
      credits: 0,
      waitingForRenewal:
        isPaidTier(creditStatus.tier) && Boolean(creditStatus.creditsRenewAt),
    };
    renderAuth(currentUser, creditStatus);
  }
  if (isWaitingForPaidRenewal(creditStatus)) {
    const renewDate = formatRenewalDate(creditStatus.creditsRenewAt);
    showToast(
      renewDate
        ? `Out of credits. Your plan renews on ${renewDate}.`
        : "Out of credits. Please wait for your plan to renew.",
      true
    );
  } else {
    showToast("You are out of credits. Open Credits to upgrade.", true);
    openCreditsPanel();
  }
  await loadCredits();
  await syncChatAccess();
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
  selectedPurchaseTier = null;
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

async function syncChatAccess() {
  if (canUseChat()) {
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
    if (await handleInsufficientCredits(err)) {
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

  if (!hasUsableCredits()) {
    showToast("You are out of credits. Open Credits to upgrade.", true);
    openCreditsPanel();
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
    if (await handleInsufficientCredits(err)) return;
    addMessage("system", `Error: ${err.message}`);
  } finally {
    if (canUseChat()) {
      chatMessage.disabled = false;
      chatMessage.focus();
    }
  }
}

function showPlan(plan) {
  currentPlan = plan;
  planSummary.textContent = plan.summary;
  exportResult.classList.add("hidden");
  updatePlanActions();
  planModal.classList.remove("hidden");
}

async function runExport({ applyTo } = {}) {
  if (!authenticated || !currentPlan) return;

  exportBtn.disabled = true;
  applyYoutubeBtn.disabled = true;
  copyCsvBtn.disabled = true;

  try {
    const data = await api("/api/export", {
      method: "POST",
      body: JSON.stringify({
        plan: currentPlan,
        ...(applyTo ? { applyTo } : {}),
      }),
    });

    lastExportCsv = data.csv;
    const lines = [
      `Saved "${data.playlist?.name || currentPlan.playlist?.name}"`,
      `${currentPlan.tracks?.length ?? 0} tracks`,
    ];

    if (data.youtube) {
      const matched = data.youtube.matched?.length ?? 0;
      const unmatched = data.youtube.unmatched?.length ?? 0;
      lines.push(`YouTube: matched ${matched}, skipped ${unmatched}`);
      if (data.youtube.playlist?.url) {
        lines.push(
          `<a href="${escapeHtml(data.youtube.playlist.url)}" target="_blank" rel="noopener noreferrer">Open on YouTube</a>`
        );
      }
    }

    exportResult.innerHTML = lines.join("<br>");
    exportResult.classList.remove("hidden");
    showToast(applyTo === "youtube" ? "Applied to YouTube!" : "Playlist saved!");
    planModal.classList.add("hidden");
    updateCreditsFromResponse(data);
  } catch (err) {
    if (await handleInsufficientCredits(err)) return;
    showToast(err.message, true);
  } finally {
    exportBtn.disabled = false;
    applyYoutubeBtn.disabled = false;
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
    const youtube = (data.connections || []).find(
      (connection) => connection.provider === "youtube"
    );
    youtubeConnected = Boolean(youtube?.connected && youtube?.available);
    updatePlanActions();
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

      const action = connection.connected
        ? `<button class="btn btn-ghost disconnect-btn" data-provider="${connection.provider}" type="button">Disconnect</button>`
        : connection.available
          ? `<button class="btn btn-primary connect-btn" data-provider="${connection.provider}" type="button">Connect</button>`
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
    <p class="connections-intro muted">Connect YouTube to apply song and video playlists directly from Mixly.</p>
    <div class="connections-list">${cards}</div>`;

  connectionsPanel.querySelectorAll(".connect-btn").forEach((btn) => {
    btn.addEventListener("click", () => connectProvider(btn.dataset.provider));
  });

  connectionsPanel.querySelectorAll(".disconnect-btn").forEach((btn) => {
    btn.addEventListener("click", () => disconnectProvider(btn.dataset.provider));
  });
}

function handleYoutubeConnectionResult() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("connections") !== "youtube") return false;

  const status = params.get("status");
  const message = params.get("message");

  if (status === "connected") {
    showToast("YouTube connected!");
    openConnectionsPanel();
    loadConnections();
    refreshConnectionState();
  } else if (status === "error") {
    showToast(message || "YouTube connection failed", true);
    openConnectionsPanel();
  }

  params.delete("connections");
  params.delete("status");
  params.delete("message");
  const nextSearch = params.toString();
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`
  );

  return status === "connected" || status === "error";
}

async function connectProvider(provider) {
  try {
    const data = await api("/api/connections", {
      method: "POST",
      body: JSON.stringify({ action: "connect", provider }),
    });
    if (provider === "youtube" && data.authorizeUrl) {
      window.location.href = data.authorizeUrl;
      return;
    }
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
    await refreshConnectionState();
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
        <div class="muted">${p.tracks} tracks${p.description ? ` · ${escapeHtml(p.description)}` : ""}${p.provider === "youtube" ? " · YouTube" : ""}</div>
        ${p.externalPlaylistUrl ? `<a class="playlist-link" href="${escapeHtml(p.externalPlaylistUrl)}" target="_blank" rel="noopener noreferrer">Open on YouTube</a>` : ""}
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
    const login = signInLogin.value.trim();
    const remember = signInRemember?.checked ?? true;
    const data = await api("/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({
        login,
        password: signInPassword.value,
        remember,
      }),
    });
    persistSignInPrefs(login, remember);
    authenticated = true;
    currentUser = data.user;
    closeAuthModalPanel();
    signInForm.reset();
    await checkAuth();
    await syncChatAccess();
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
    const remember = signUpRemember?.checked ?? true;
    const data = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: signUpEmail.value.trim(),
        username: signUpUsername.value.trim(),
        password: signUpPassword.value,
        remember,
      }),
    });
    persistSignInPrefs(signUpUsername.value.trim(), remember);
    authenticated = true;
    currentUser = data.user;
    closeAuthModalPanel();
    signUpForm.reset();
    await checkAuth();
    await syncChatAccess();
    showToast("Account created");
  } catch (err) {
    signUpError.textContent = err.message;
    signUpError.classList.remove("hidden");
  }
}

function switchPanel(panelName) {
  document.querySelectorAll(".tool-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.panel === panelName);
  });
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
  document.getElementById(`panel-${panelName}`)?.classList.add("active");
  if (panelName === "playlists") loadPlaylists();
  if (panelName === "connections") loadConnections();
  if (panelName === "credits") loadCredits();
}

document.querySelectorAll(".tool-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!authenticated) {
    showToast("Sign in first", true);
    openAuthModal("signin");
    return;
  }
  if (!hasUsableCredits()) {
    showToast("You are out of credits. Open Credits to upgrade.", true);
    openCreditsPanel();
    return;
  }
  const text = chatMessage.value.trim();
  if (!text) return;
  chatMessage.value = "";
  sendMessage(text);
});

exportBtn.addEventListener("click", () => runExport());
applyYoutubeBtn?.addEventListener("click", () => runExport({ applyTo: "youtube" }));
connectYoutubeBtn?.addEventListener("click", () => {
  planModal.classList.add("hidden");
  openConnectionsPanel();
});
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
chatLockActionBtn?.addEventListener("click", () => chatLockAction());
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
  try {
    const headers = {};
    const code = getStoredAccessCode();
    if (code) headers["X-Site-Access-Code"] = code;

    const data = await fetch("/api/access", {
      credentials: "same-origin",
      headers,
    }).then((res) => res.json());

    if (!data.enabled || data.unlocked) {
      showApp();
      return true;
    }
  } catch {
    /* fall through to gate form */
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
    await fetch("/api/access", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Invalid access code");
      return data;
    });

    setStoredAccessCode(code);
    gateCode.value = "";
    showApp();
    await checkAuth();
    await syncChatAccess();
  } catch (err) {
    setStoredAccessCode("");
    gateError.textContent = err.message || "Invalid access code";
    gateError.classList.remove("hidden");
  }
});

function clearPurchaseQueryParams() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("purchase")) return;

  params.delete("purchase");
  params.delete("tier");
  const nextSearch = params.toString();
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`
  );
}

async function handlePurchaseReturn(tierId) {
  selectedPurchaseTier = null;

  if (!authenticated) {
    showToast("Purchase received. Sign in to apply your credits.", true);
    openAuthModal("signin");
    return;
  }

  try {
    const data = await api("/api/credits", {
      method: "POST",
      body: JSON.stringify({ action: "confirm", tier: tierId || undefined }),
    });
    creditStatus = data;
    lastCreditsPanelData = data;
    renderAuth(currentUser, creditStatus);
    renderCreditsPanel();
    await syncChatAccess();
    showToast(`Purchase complete! You now have ${data.credits?.toLocaleString?.() ?? data.tierCredits} credits.`);
    openCreditsPanel();
  } catch (err) {
    showToast(err.message || "Purchase received. Refresh after signing in.", true);
    openCreditsPanel();
  }
}

(async function init() {
  const params = new URLSearchParams(window.location.search);
  const purchaseSuccess = params.get("purchase") === "success";
  const purchaseTier = params.get("tier");

  setupCreditsPanelEvents();

  const unlocked = await requireGateOnVisit();
  if (!unlocked) {
    if (purchaseSuccess) {
      gateError.textContent = "Enter your access code to finish applying your purchase.";
      gateError.classList.remove("hidden");
    }
    return;
  }

  await checkAuth();
  handleYoutubeConnectionResult();
  await syncChatAccess();

  if (purchaseSuccess) {
    clearPurchaseQueryParams();
    await handlePurchaseReturn(purchaseTier);
  }
})();
