/* MYFLIX subscription/account module
   The subscription key below is editable.
   Each successful key activation grants exactly 10 hours of viewing access.
   The expiry time is stored in localStorage so the countdown continues after
   closing/reopening the browser.

   IMPORTANT: This is client-side gating. A key stored in browser JavaScript
   is not secret. For real paid access, validate subscriptions on a server
   and issue short-lived sessions/tokens.
*/
(() => {
  "use strict";

  // ===== CHANGE YOUR SUBSCRIPTION KEY HERE =====
  const SUBSCRIPTION_KEY = "MYFLIX-2026-DEMO";
  // =============================================

  // Subscription duration: exactly 10 hours.
  const SUBSCRIPTION_DURATION_MS = 10 * 60 * 60 * 1000;

  const ACCOUNT_STORAGE = "myflix.account.v1";
  const SUB_STORAGE = "myflix.subscription.v2";
  const OLD_SUB_STORAGE = "myflix.subscription.v1";
  const $ = (id) => document.getElementById(id);
  let countdownTimer = null;

  function getAccount() {
    try { return JSON.parse(localStorage.getItem(ACCOUNT_STORAGE) || "null"); }
    catch { return null; }
  }

  function getSubscription() {
    try {
      const value = JSON.parse(localStorage.getItem(SUB_STORAGE) || "null");
      if (!value || typeof value.expiresAt !== "number" || typeof value.activatedAt !== "number") {
        return null;
      }
      return value;
    } catch {
      return null;
    }
  }

  function clearSubscription() {
    localStorage.removeItem(SUB_STORAGE);
    // Remove the old permanent-style flag if it exists.
    localStorage.removeItem(OLD_SUB_STORAGE);
  }

  function remainingMs() {
    const sub = getSubscription();
    if (!sub) return 0;
    return Math.max(0, sub.expiresAt - Date.now());
  }

  function isSubscribed() {
    return Boolean(getAccount() && remainingMs() > 0);
  }

  function formatRemaining(ms) {
    if (ms <= 0) return "Expired";
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
  }

  function updateCountdown() {
    const status = $("subscriptionStatus");
    const countdown = $("subscriptionCountdown");
    const row = $("subscriptionCountdownRow");
    const sub = getSubscription();
    const remaining = remainingMs();

    if (!sub || remaining <= 0) {
      if (remaining <= 0 && sub) clearSubscription();
      if (status) status.textContent = "Not active";
      if (countdown) countdown.textContent = "—";
      if (row) row.classList.add("expired");
      return;
    }

    if (status) status.textContent = "Active";
    if (countdown) countdown.textContent = formatRemaining(remaining);
    if (row) row.classList.remove("expired");
  }

  function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    updateCountdown();
    countdownTimer = setInterval(() => {
      updateCountdown();
      if (!isSubscribed()) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }, 1000);
  }

  function updateHeader() {
    const btn = $("accountBtn");
    if (btn) btn.textContent = getAccount() ? "👤 Profile" : "👤 Create Account";
  }

  function showStep(step) {
    ["createStep", "profileStep", "keyStep"].forEach(id => $(id)?.classList.remove("active"));
    $(step)?.classList.add("active");

    const account = getAccount();
    $("accountTitle").textContent =
      step === "createStep" ? "Create Account" :
      step === "keyStep" ? "Subscription Key" : "Profile";

    if (account) {
      $("profileName").textContent = account.name;
      $("profileEmail").textContent = account.email;
      updateCountdown();
    }
  }

  function openAccount(step) {
    $("accountModal").classList.add("show");
    showStep(getAccount() ? (step || "profileStep") : "createStep");
  }

  function closeAccount() {
    $("accountModal").classList.remove("show");
    $("createMsg").textContent = "";
    $("profileMsg").textContent = "";
    $("keyMsg").textContent = "";
    $("subscriptionKey").value = "";
  }

  function promptForAccess() {
    if (!getAccount()) {
      openAccount("createStep");
      $("createMsg").textContent = "Create an account before watching a movie.";
      return;
    }

    if (!isSubscribed()) {
      openAccount("keyStep");
      $("keyMsg").textContent = "Your 10-hour subscription is not active. Enter your key to start a new 10-hour session.";
      return;
    }
  }

  function canWatch() {
    return Boolean(getAccount() && isSubscribed());
  }

  $("accountBtn")?.addEventListener("click", () => openAccount());
  $("accountClose")?.addEventListener("click", closeAccount);

  $("accountModal")?.addEventListener("click", event => {
    if (event.target === $("accountModal")) closeAccount();
  });

  $("createAccount")?.addEventListener("click", () => {
    const name = $("accountName").value.trim();
    const email = $("accountEmail").value.trim();

    if (name.length < 2) {
      $("createMsg").textContent = "Please enter your name.";
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $("createMsg").textContent = "Please enter a valid email address.";
      return;
    }

    localStorage.setItem(ACCOUNT_STORAGE, JSON.stringify({ name, email }));
    updateHeader();
    showStep("profileStep");
  });

  $("subscriptionBtn")?.addEventListener("click", () => showStep("keyStep"));
  $("backProfile")?.addEventListener("click", () => showStep("profileStep"));

  $("activateKey")?.addEventListener("click", () => {
    const entered = $("subscriptionKey").value.trim();

    if (!entered) {
      $("keyMsg").textContent = "Enter a subscription key.";
      return;
    }

    if (entered !== SUBSCRIPTION_KEY) {
      $("keyMsg").textContent = "Invalid subscription key.";
      return;
    }

    const activatedAt = Date.now();
    const expiresAt = activatedAt + SUBSCRIPTION_DURATION_MS;

    localStorage.setItem(SUB_STORAGE, JSON.stringify({
      activatedAt,
      expiresAt
    }));

    // Never leave the key visible after activation.
    $("subscriptionKey").value = "";

    showStep("profileStep");
    $("profileMsg").textContent = "Subscription activated for 10 hours. The countdown has started.";
    startCountdown();
  });

  $("signOutBtn")?.addEventListener("click", () => {
    localStorage.removeItem(ACCOUNT_STORAGE);
    clearSubscription();
    updateHeader();
    showStep("createStep");
    $("createMsg").textContent = "You have signed out.";
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  });

  // Old version stored only "active" and had no expiry time. Do not let that
  // old permanent-style value bypass the new 10-hour rule.
  if (localStorage.getItem(OLD_SUB_STORAGE) === "active" && !getSubscription()) {
    localStorage.removeItem(OLD_SUB_STORAGE);
  }

  window.MyflixAuth = { canWatch, promptForAccess, openAccount };

  updateHeader();
  startCountdown();
})();
