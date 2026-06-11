"use strict";

(function () {
  const VIEWS = {
    challenge: document.getElementById("view-challenge"),
    passed: document.getElementById("view-passed"),
    confirmed: document.getElementById("view-confirmed"),
  };

  const errorEl = document.getElementById("challenge-error");
  const confirmBtn = document.getElementById("confirm-btn");
  const mount = document.getElementById("turnstile-mount");

  function showView(name) {
    Object.entries(VIEWS).forEach(([key, el]) => {
      if (!el) return;
      if (key === name) {
        el.hidden = false;
      } else {
        el.hidden = true;
      }
    });
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = "";
    errorEl.hidden = true;
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error("request failed: " + res.status);
    return res.json();
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  }

  async function loadSiteKey() {
    const cfg = await fetchJSON("/api/config");
    if (!cfg || typeof cfg.siteKey !== "string" || !cfg.siteKey) {
      throw new Error("config: missing siteKey");
    }
    window.__TURNSTILE_SITE_KEY__ = cfg.siteKey;
  }

  function turnstileReady() {
    return (
      typeof window.turnstile !== "undefined" &&
      typeof window.turnstile.render === "function" &&
      typeof window.__TURNSTILE_SITE_KEY__ === "string" &&
      window.__TURNSTILE_SITE_KEY__.length > 0
    );
  }

  function renderTurnstileWidget() {
    if (!mount) return;
    if (currentState !== "challenge") return;
    if (!turnstileReady()) {
      window.setTimeout(renderTurnstileWidget, 80);
      return;
    }
    const sitekey = window.__TURNSTILE_SITE_KEY__;
    window.turnstile.render(mount, {
      sitekey: sitekey,
      callback: function (token) {
        window.onTurnstileSuccess(token);
      },
      "error-callback": function () {
        showError("Verification failed. Please try again.");
      },
      "expired-callback": function () {
        showError("Challenge expired. Refreshing…");
        window.setTimeout(function () { window.location.reload(); }, 800);
      },
    });
  }

  window.onTurnstileLoad = function () {
    if (currentState === "challenge") {
      renderTurnstileWidget();
    }
  };

  window.onTurnstileSuccess = async function (token) {
    clearError();
    const result = await postJSON("/api/verify", { token: token });
    if (!result.ok || !result.data || result.data.ok !== true) {
      showError(
        (result.data && result.data.error) || "Verification failed (HTTP " + result.status + ")."
      );
      return;
    }
    showView("passed");
  };

  async function handleConfirmClick() {
    if (!confirmBtn) return;
    confirmBtn.disabled = true;
    const original = confirmBtn.textContent;
    confirmBtn.textContent = "…";
    try {
      const result = await postJSON("/api/confirm", {});
      if (!result.ok || !result.data || result.data.ok !== true) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = original;
        alert(
          (result.data && result.data.error) || "Confirmation failed (HTTP " + result.status + ")."
        );
        return;
      }
      showView("confirmed");
    } catch (e) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = original;
      alert("Network error: " + (e && e.message ? e.message : "unknown"));
    }
  }

  let currentState = "challenge";

  async function init() {
    if (confirmBtn) confirmBtn.addEventListener("click", handleConfirmClick);

    try {
      await loadSiteKey();
    } catch (e) {
      showError("Failed to load site configuration. Reload the page.");
      return;
    }

    try {
      const state = await fetchJSON("/api/state");
      currentState = state.state || "challenge";
    } catch (e) {
      currentState = "challenge";
    }

    showView(currentState);

    if (currentState === "challenge") {
      renderTurnstileWidget();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
