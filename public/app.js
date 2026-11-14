(() => {
  "use strict";

  const STATUS_ORDER = ["awaiting_owner", "ai_handled", "owner_handled", "resolved"];
  const STATUS_LABELS = {
    awaiting_owner: "AWAITING YOU",
    ai_handled: "AI REPLIED",
    owner_handled: "YOU REPLIED",
    resolved: "RESOLVED"
  };

  const state = {
    conversations: [],
    activeId: null,
    activeConversation: null,
    activeMessages: [],
    settings: null,
    threadPollInterval: null
  };

  // ---- DOM refs ----
  const appEl = document.querySelector(".app");
  const bizNameEl = document.getElementById("bizName");
  const aiToggleEl = document.getElementById("aiToggle");
  const aiToggleStateEl = document.getElementById("aiToggleState");
  const checkNowBtnEl = document.getElementById("checkNowBtn");
  const statsEl = document.getElementById("stats");
  const slipStackEl = document.getElementById("slipStack");
  const openSettingsBtnEl = document.getElementById("openSettings");

  const emptyStateEl = document.getElementById("emptyState");
  const threadEl = document.getElementById("thread");
  const threadNameEl = document.getElementById("threadName");
  const threadMetaEl = document.getElementById("threadMeta");
  const countdownChipEl = document.getElementById("countdownChip");
  const resolveBtnEl = document.getElementById("resolveBtn");
  const messagesEl = document.getElementById("messages");
  const composerFormEl = document.getElementById("composerForm");
  const composerInputEl = document.getElementById("composerInput");
  const sendBtnEl = document.getElementById("sendBtn");
  const backBtnEl = document.getElementById("backBtn");

  const settingsBackdropEl = document.getElementById("settingsBackdrop");
  const settingsFormEl = document.getElementById("settingsForm");
  const cancelSettingsEl = document.getElementById("cancelSettings");
  const f_business_name = document.getElementById("f_business_name");
  const f_hours = document.getElementById("f_hours");
  const f_services = document.getElementById("f_services");
  const f_faq_text = document.getElementById("f_faq_text");
  const f_reply_delay_minutes = document.getElementById("f_reply_delay_minutes");
  const f_ai_enabled = document.getElementById("f_ai_enabled");

  const toastEl = document.getElementById("toast");
  let toastTimeout = null;

  // ---- small helpers ----

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (ch) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
  }

  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* no JSON body */
    }
    if (!res.ok) {
      throw new Error((data && data.error) || `Request failed (${res.status})`);
    }
    return data;
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastEl.hidden = true;
    }, 3500);
  }

  function formatRelativeTime(dateStr) {
    if (!dateStr) return "—";
    const diffSec = Math.round((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diffSec < 30) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.round(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  function formatClockTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function formatCountdown(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function isNearBottom(el) {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  // ---- slip stack (conversation list) ----

  function renderStats() {
    const counts = { awaiting_owner: 0, ai_handled: 0, owner_handled: 0, resolved: 0 };
    state.conversations.forEach((c) => {
      if (counts[c.status] !== undefined) counts[c.status] += 1;
    });
    statsEl.innerHTML = `
      <span>Awaiting <strong>${counts.awaiting_owner}</strong></span>
      <span>AI <strong>${counts.ai_handled}</strong></span>
      <span>You <strong>${counts.owner_handled}</strong></span>
      <span>Resolved <strong>${counts.resolved}</strong></span>
    `;
  }

  function renderPills(status) {
    return STATUS_ORDER.map((s) => {
      const on = s === status ? `on ${s}` : "";
      return `<span class="pill ${on}">${STATUS_LABELS[s]}</span>`;
    }).join("");
  }

  function renderSlip(conv) {
    const name = conv.client_name || conv.platform_user_id || "Unknown";
    const preview = conv.last_message_content
      ? escapeHtml(conv.last_message_content)
      : "(no messages yet)";
    const time = formatRelativeTime(conv.last_message_at);
    const activeClass = conv.id === state.activeId ? " active" : "";

    let timerHtml = "";
    if (conv.status === "awaiting_owner" && conv.reply_due_at) {
      timerHtml = `<div class="slip-timer" data-role="countdown" data-due="${conv.reply_due_at}">AI replies in …</div>`;
    }

    return `
      <div class="slip${activeClass}" data-id="${conv.id}" role="button" tabindex="0">
        <div class="slip-head">
          <span class="slip-brand">WHILE YOU WERE OUT</span>
          <span class="slip-platform">${escapeHtml((conv.platform || "").toUpperCase())}</span>
        </div>
        <div class="slip-row"><span class="slip-label">FROM</span><span class="slip-value">${escapeHtml(name)}</span></div>
        <div class="slip-row slip-message"><span class="slip-label">MSG</span><span class="slip-value">${preview}</span></div>
        <div class="slip-row"><span class="slip-label">TIME</span><span class="slip-value">${time}</span></div>
        ${timerHtml}
        <div class="slip-pills">${renderPills(conv.status)}</div>
      </div>
    `;
  }

  function renderSlipStack() {
    if (!state.conversations.length) {
      slipStackEl.innerHTML = `<div class="list-empty">No messages yet — once a customer DMs your Instagram, it'll show up here as a slip.</div>`;
      return;
    }
    slipStackEl.innerHTML = state.conversations.map(renderSlip).join("");
  }

  async function loadConversations({ silent = false } = {}) {
    try {
      const data = await fetchJSON("/api/conversations");
      state.conversations = data.conversations || [];
      renderSlipStack();
      renderStats();
    } catch (err) {
      if (!silent) {
        slipStackEl.innerHTML = `<div class="list-error">Couldn't load conversations — ${escapeHtml(err.message)}</div>`;
      }
    }
  }

  // ---- thread pane ----

  function renderThreadHeader() {
    const c = state.activeConversation;
    threadNameEl.textContent = c.client_name || c.platform_user_id || "Unknown";
    threadMetaEl.textContent = `${(c.platform || "").toUpperCase()} · ${STATUS_LABELS[c.status] || c.status}`;

    if (c.status === "awaiting_owner" && c.reply_due_at) {
      countdownChipEl.hidden = false;
      countdownChipEl.dataset.due = c.reply_due_at;
      countdownChipEl.dataset.role = "countdown";
    } else {
      countdownChipEl.hidden = true;
      delete countdownChipEl.dataset.due;
    }

    resolveBtnEl.disabled = c.status === "resolved";
    resolveBtnEl.textContent = c.status === "resolved" ? "Resolved" : "Mark resolved";
  }

  function renderMessage(m) {
    const cls = m.sender === "client" ? "client" : m.sender === "ai" ? "ai" : "owner";
    const tag = m.sender === "client" ? "" : m.sender === "ai" ? "AI" : "YOU";
    return `
      <div class="msg ${cls}">
        ${tag ? `<span class="msg-tag">${tag}</span>` : ""}
        ${escapeHtml(m.content)}
        <span class="msg-time">${formatClockTime(m.sent_at)}</span>
      </div>
    `;
  }

  function renderMessages() {
    const isNewConversation = messagesEl.dataset.forId !== String(state.activeId);
    const nearBottom = isNewConversation || isNearBottom(messagesEl);
    messagesEl.innerHTML = state.activeMessages.map(renderMessage).join("");
    messagesEl.dataset.forId = String(state.activeId);
    if (nearBottom) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  async function refreshActiveConversation() {
    if (!state.activeId) return;
    try {
      const data = await fetchJSON(`/api/conversations/${state.activeId}`);
      state.activeConversation = data.conversation;
      state.activeMessages = data.messages || [];
      renderThreadHeader();
      renderMessages();
    } catch (err) {
      showToast(`Couldn't refresh conversation — ${err.message}`);
    }
  }

  async function openConversation(id) {
    state.activeId = id;
    appEl.classList.add("viewing-thread");
    emptyStateEl.hidden = true;
    threadEl.hidden = false;
    renderSlipStack();
    await refreshActiveConversation();

    clearInterval(state.threadPollInterval);
    state.threadPollInterval = setInterval(refreshActiveConversation, 5000);
  }

  // ---- countdown ticking (list slips + thread chip) ----

  function tickCountdowns() {
    const now = Date.now();
    document.querySelectorAll('[data-role="countdown"]').forEach((el) => {
      if (!el.dataset.due) return;
      const msLeft = new Date(el.dataset.due).getTime() - now;
      el.textContent = msLeft > 0 ? `AI replies in ${formatCountdown(msLeft)}` : "AI replying any moment…";
    });
  }
  setInterval(tickCountdowns, 1000);

  // ---- composer ----

  composerFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = composerInputEl.value.trim();
    if (!text || !state.activeId) return;

    sendBtnEl.disabled = true;
    try {
      await fetchJSON(`/api/conversations/${state.activeId}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: text })
      });
      composerInputEl.value = "";
      await refreshActiveConversation();
      await loadConversations({ silent: true });
      showToast("Reply sent.");
    } catch (err) {
      showToast(`Couldn't send — ${err.message}`);
    } finally {
      sendBtnEl.disabled = false;
    }
  });

  composerInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      composerFormEl.requestSubmit();
    }
  });

  resolveBtnEl.addEventListener("click", async () => {
    if (!state.activeId) return;
    try {
      await fetchJSON(`/api/conversations/${state.activeId}/resolve`, { method: "POST" });
      await refreshActiveConversation();
      await loadConversations({ silent: true });
      showToast("Marked resolved.");
    } catch (err) {
      showToast(`Couldn't resolve — ${err.message}`);
    }
  });

  // ---- list interactions ----

  slipStackEl.addEventListener("click", (e) => {
    const slip = e.target.closest(".slip");
    if (slip) openConversation(slip.dataset.id);
  });

  slipStackEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const slip = e.target.closest(".slip");
    if (slip) {
      e.preventDefault();
      openConversation(slip.dataset.id);
    }
  });

  backBtnEl.addEventListener("click", () => {
    appEl.classList.remove("viewing-thread");
  });

  // ---- settings ----

  function applySettingsToHeader() {
    if (!state.settings) return;
    bizNameEl.textContent = state.settings.business_name || "My Business";
    const enabled = state.settings.ai_enabled !== false;
    aiToggleEl.setAttribute("aria-pressed", String(enabled));
    aiToggleStateEl.textContent = enabled ? "on" : "off";
  }

  async function loadSettingsSummary() {
    try {
      const data = await fetchJSON("/api/settings");
      state.settings = data.settings;
      applySettingsToHeader();
    } catch (err) {
      bizNameEl.textContent = "My Business";
    }
  }

  async function openSettingsModal() {
    try {
      const data = await fetchJSON("/api/settings");
      state.settings = data.settings;
      f_business_name.value = state.settings.business_name || "";
      f_hours.value = state.settings.hours || "";
      f_services.value = state.settings.services || "";
      f_faq_text.value = state.settings.faq_text || "";
      f_reply_delay_minutes.value = state.settings.reply_delay_minutes ?? 5;
      f_ai_enabled.checked = state.settings.ai_enabled !== false;
      settingsBackdropEl.hidden = false;
    } catch (err) {
      showToast(`Couldn't load settings — ${err.message}`);
    }
  }

  function closeSettingsModal() {
    settingsBackdropEl.hidden = true;
  }

  openSettingsBtnEl.addEventListener("click", openSettingsModal);
  cancelSettingsEl.addEventListener("click", closeSettingsModal);
  settingsBackdropEl.addEventListener("click", (e) => {
    if (e.target === settingsBackdropEl) closeSettingsModal();
  });

  settingsFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      business_name: f_business_name.value.trim(),
      hours: f_hours.value.trim(),
      services: f_services.value.trim(),
      faq_text: f_faq_text.value.trim(),
      reply_delay_minutes: Number(f_reply_delay_minutes.value) || 5,
      ai_enabled: f_ai_enabled.checked
    };
    try {
      const data = await fetchJSON("/api/settings", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      state.settings = data.settings;
      applySettingsToHeader();
      closeSettingsModal();
      showToast("Settings saved.");
    } catch (err) {
      showToast(`Couldn't save — ${err.message}`);
    }
  });

  aiToggleEl.addEventListener("click", async () => {
    if (!state.settings) await loadSettingsSummary();
    const newValue = !(state.settings.ai_enabled !== false);
    try {
      const data = await fetchJSON("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ ...state.settings, ai_enabled: newValue })
      });
      state.settings = data.settings;
      applySettingsToHeader();
      showToast(`AI replies turned ${newValue ? "on" : "off"}.`);
    } catch (err) {
      showToast(`Couldn't update — ${err.message}`);
    }
  });

  // ---- check now ----

  checkNowBtnEl.addEventListener("click", async () => {
    checkNowBtnEl.disabled = true;
    try {
      const result = await fetchJSON("/api/check-timers", { method: "POST" });
      if (result.aiDisabled) {
        showToast(`AI replies are off — ${result.dueCount} conversation(s) waiting.`);
      } else {
        showToast(
          `Checked ${result.dueCount} overdue — sent ${result.processed}, skipped ${result.skipped}, failed ${result.failed}.`
        );
      }
      await loadConversations({ silent: true });
      if (state.activeId) await refreshActiveConversation();
    } catch (err) {
      showToast(`Check failed — ${err.message}`);
    } finally {
      checkNowBtnEl.disabled = false;
    }
  });

  // ---- init ----

  async function init() {
    await Promise.all([loadConversations(), loadSettingsSummary()]);
    setInterval(() => loadConversations({ silent: true }), 8000);
  }

  init();
})();
