const API = "https://m10.vedatmillerkov.workers.dev";
const WALLET_ADDRESS = "TP4DPLKPQnN4HgHHWeo9n2mCUvJR7uZwPZ";
const NETWORK = "Tron (TRC20)";
const TELEGRAM_SUPPORT = "https://t.me/vdtmlrkv";
const state = { plan: null, price: 0, orderId: null, notified: false, ad: "", adUnlocked: false };

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

function fallbackAd(payload) {
  if (payload.language === "العربية") {
    return `العنوان: ${payload.product_name} بإعلان جاهز يلفت الانتباه\n\n${payload.brief}\n\nنص الإعلان: خلي منتجك يبين بشكل أقوى وأوضح مع إعلان سريع وجاهز للنشر. ${payload.product_name} مصمم ليجذب الانتباه ويحول المشاهد إلى عميل.\n\nالدعوة للإجراء: اطلب الآن\nالهاشتاغات: #${payload.product_name.replace(/\s+/g, "")} #اعلان #تسويق`;
  }
  if (payload.language === "Türkçe") {
    return `Baslik: ${payload.product_name} ile daha guclu gorunun\n\n${payload.brief}\n\nReklam metni: ${payload.product_name}, markanizi daha dikkat cekici gostermek icin hazirlandi. Hemen deneyin ve farki dakikalar icinde gorun.\n\nCTA: Simdi kesfet\nHashtags: #${payload.product_name.replace(/\s+/g, "")} #AIAds #Marketing`;
  }
  return `Headline: Make ${payload.product_name} impossible to ignore\n\n${payload.brief}\n\nAd copy: Show your product with a clear, ready-to-post message built to catch attention fast. ${payload.product_name} is positioned as the simple choice for customers who want results without overthinking.\n\nCTA: Order now\nHashtags: #${payload.product_name.replace(/\s+/g, "")} #AIAds #Marketing`;
}

async function createServerOrder() {
  const payload = getOrderPayload();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const r = await fetch(`${API}/api/order`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || data.error || "Order notification failed");
    return data;
  } finally {
    clearTimeout(timer);
  }
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
    txid ? `TXID: ${txid}` : "TXID: add after transfer",
    "",
    state.adUnlocked ? "Generated ad:" : "Generated ad: locked until TXID is entered",
    state.adUnlocked ? state.ad : ""
  ].join("\n");
}

function notificationText() {
  if (state.notified) return "Order notification sent to M10 Telegram.";
  return "Order generated. Paste TXID after payment to unlock the AI ad.";
}

function renderAdSection() {
  const locked = !state.adUnlocked;
  return `
    <div class="generated-ad ${locked ? "locked" : ""}">
      <p class="eyebrow">AI AD OUTPUT</p>
      ${locked ? `<p class="note">AI ad is ready. Paste the USDT TXID after payment and tap Unlock AI ad.</p>` : `<pre id="adOutput"></pre><button id="copyAd" type="button">Copy AI ad</button>`}
    </div>
  `;
}

function bindAdActions() {
  const unlock = $("#unlockAd");
  if (unlock) {
    unlock.onclick = () => {
      const txid = $("#txid").value.trim();
      if (!txid) {
        alert("Please paste the TXID after sending USDT.");
        return;
      }
      state.adUnlocked = true;
      renderManualUsdtCheckout();
    };
  }
  const adOutput = $("#adOutput");
  if (adOutput) adOutput.textContent = state.ad;
  const copyAd = $("#copyAd");
  if (copyAd) copyAd.onclick = () => copyText(state.ad, copyAd);
}

function renderManualUsdtCheckout() {
  let panel = $("#manualPayment");
  const txidValue = $("#txid")?.value.trim() || "";
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
      <input id="txid" placeholder="Paste TXID after sending USDT" value="${txidValue}">
    </label>
    <button id="unlockAd" type="button" class="primary">Unlock AI ad after payment</button>
    <button id="copyOrder" type="button" class="secondary">Copy payment confirmation</button>
    <a id="telegramSupport" class="secondary" href="${TELEGRAM_SUPPORT}" target="_blank" rel="noopener">Send confirmation on Telegram</a>
    ${renderAdSection()}
    <p class="note">The full ad is shown after TXID is entered. Automatic blockchain verification is the next payment upgrade.</p>
  `;

  $("#copyWallet").onclick = () => copyText(WALLET_ADDRESS, $("#copyWallet"));
  $("#copyOrder").onclick = () => {
    const txid = $("#txid").value.trim();
    copyText(orderDetailsText(txid), $("#copyOrder"));
  };
  bindAdActions();
  panel.scrollIntoView({ behavior: "smooth" });
}

async function showManualUsdtCheckout(button) {
  button.disabled = true;
  button.textContent = "Creating AI ad...";
  const payload = getOrderPayload();
  state.orderId = makeOrderId();
  state.notified = false;
  state.adUnlocked = false;
  state.ad = fallbackAd(payload);
  try {
    const data = await createServerOrder();
    state.orderId = data.order_id || state.orderId;
    state.notified = Boolean(data.telegram && data.telegram.sent);
    if (data.ad && data.ad.content) state.ad = data.ad.content;
  } catch (error) {
    console.warn("M10 order AI fallback:", error);
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
