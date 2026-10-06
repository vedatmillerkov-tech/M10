const API = "https://m10.vedatmillerkov.workers.dev";
const WALLET_ADDRESS = "TP4DPLKPQnN4HgHHWeo9n2mCUvJR7uZwPZ";
const NETWORK = "Tron (TRC20)";
const TELEGRAM_SUPPORT = "https://t.me/vdtmlrkv";
const state = { plan: null, price: 0, orderId: null, notified: false };

const $ = (selector) => document.querySelector(selector);
const plans = document.querySelectorAll("[data-plan]");
const payment = $("#payment");

function ensureContactField() {
  if ($("#contact")) return;
  const languageLabel = $("#language")?.closest("label");
  if (!languageLabel) return;
  const label = document.createElement("label");
  label.textContent = "Your Telegram username or email";
  const input = document.createElement("input");
  input.id = "contact";
  input.placeholder = "Example: @username or email@example.com";
  label.appendChild(input);
  languageLabel.parentNode.insertBefore(label, languageLabel);
}

function makeOrderId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `M10-${date}-${random}`;
}

function getOrderPayload() {
  return {
    plan: state.plan,
    product_name: $("#product").value.trim(),
    contact: $("#contact")?.value.trim() || "",
    language: $("#language").value,
    brief: $("#brief").value.trim()
  };
}

async function createServerOrder() {
  const payload = getOrderPayload();
  const r = await fetch(`${API}/api/order`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || data.error || "Order notification failed");
  return data;
}

function copyText(text, button) {
  if (!navigator.clipboard) {
    window.prompt("Copy this text:", text);
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    const oldText = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = oldText; }, 1400);
  }).catch(() => window.prompt("Copy this text:", text));
}

function orderDetailsText(txid = "") {
  const payload = getOrderPayload();
  return [
    "M10 USDT PAYMENT CONFIRMATION",
    `Order ID: ${state.orderId}`,
    `Plan: ${state.plan}`,
    `Amount: ${state.price.toFixed(2)} USDT`,
    `Network: ${NETWORK}`,
    `Wallet: ${WALLET_ADDRESS}`,
    `Customer contact: ${payload.contact}`,
    `Product: ${payload.product_name}`,
    `Language: ${payload.language}`,
    `Brief: ${payload.brief}`,
    txid ? `TXID: ${txid}` : "TXID: add after transfer"
  ].join("\n");
}

function notificationText() {
  if (state.notified) return "Order notification sent to M10 Telegram.";
  return "Order notification is prepared. If Telegram automation is not active yet, use the copy button as backup.";
}

function renderManualUsdtCheckout() {
  let panel = $("#manualPayment");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "manualPayment";
    payment.appendChild(panel);
  }

  panel.className = "manual-pay";
  panel.innerHTML = `
    <p class="eyebrow">USDT TELEGRAM WALLET</p>
    <h3>Send ${state.price.toFixed(2)} USDT</h3>
    <p class="danger">Send only USDT on Tron (TRC20). Any other network may cause permanent loss.</p>
    <div class="payment-grid">
      <span>Order ID</span><strong>${state.orderId}</strong>
      <span>Network</span><strong>${NETWORK}</strong>
      <span>Amount</span><strong>${state.price.toFixed(2)} USDT</strong>
    </div>
    <p class="note">${notificationText()}</p>
    <label>Telegram Wallet address
      <div class="copy-row">
        <input id="walletAddress" readonly value="${WALLET_ADDRESS}">
        <button id="copyWallet" type="button">Copy</button>
      </div>
    </label>
    <a class="secondary" href="https://t.me/wallet" target="_blank" rel="noopener">Open Telegram Wallet</a>
    <label>Transaction ID / TXID after payment
      <input id="txid" placeholder="Paste TXID after sending USDT">
    </label>
    <button id="copyOrder" type="button" class="primary">Copy payment confirmation</button>
    <a id="telegramSupport" class="secondary" href="${TELEGRAM_SUPPORT}" target="_blank" rel="noopener">Send confirmation on Telegram</a>
    <p class="note">The order stays pending until the USDT transfer is checked. Telegram automation is the main path; copy/manual confirmation is backup.</p>
  `;

  $("#copyWallet").onclick = () => copyText(WALLET_ADDRESS, $("#copyWallet"));
  $("#copyOrder").onclick = () => {
    const txid = $("#txid").value.trim();
    copyText(orderDetailsText(txid), $("#copyOrder"));
  };
  panel.scrollIntoView({ behavior: "smooth" });
}

async function showManualUsdtCheckout(button) {
  button.disabled = true;
  button.textContent = "Creating order...";
  state.orderId = makeOrderId();
  state.notified = false;
  try {
    const data = await createServerOrder();
    state.orderId = data.order_id || state.orderId;
    state.notified = Boolean(data.telegram && data.telegram.sent);
  } catch (error) {
    console.warn("M10 order notification fallback:", error);
  } finally {
    button.disabled = false;
    button.textContent = "₮ Pay with USDT";
    renderManualUsdtCheckout();
  }
}

plans.forEach((button) => {
  button.onclick = () => {
    state.plan = button.dataset.plan;
    state.price = Number(button.dataset.price);
    $("#order").classList.remove("hidden");
    ensureContactField();
    payment.classList.add("hidden");
    const manualPanel = $("#manualPayment");
    if (manualPanel) manualPanel.remove();
    $("#orderTitle").textContent = `${state.plan} — $${state.price.toFixed(2)}`;
    $("#order").scrollIntoView({ behavior: "smooth" });
  };
});

$("#continue").onclick = () => {
  ensureContactField();
  const payload = getOrderPayload();
  if (!payload.product_name || !payload.contact || !payload.brief) {
    alert("Please add your product name, contact, and a short description.");
    return;
  }
  payment.classList.remove("hidden");
  payment.scrollIntoView({ behavior: "smooth" });
};

document.querySelectorAll(".pay").forEach((button) => {
  button.onclick = () => {
    if (button.dataset.method !== "crypto") {
      alert("Card payment is coming soon. No charge will be made.");
      return;
    }
    showManualUsdtCheckout(button);
  };
});
