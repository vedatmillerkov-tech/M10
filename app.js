const API = "https://m10.vedatmillerkov.workers.dev";
const WALLET_ADDRESS = "TP4DPLKPQnN4HgHHWeo9n2mCUvJR7uZwPZ";
const NETWORK = "Tron (TRC20)";
const TELEGRAM_SUPPORT = "https://t.me/vdtmlrkv";
const state = { plan: null, price: 0, orderId: null, notified: false, ad: "", adUnlocked: false, verificationMessage: "" };

const $ = (selector) => document.querySelector(selector);
const plans = document.querySelectorAll("[data-plan]");
const payment = $("#payment");

function ensureUsdtOnlyPayment() {
  document.querySelectorAll('.pay').forEach((button) => {
    if (button.dataset.method !== 'crypto') button.remove();
  });
  const paymentTitle = payment?.querySelector('h3');
  if (paymentTitle) paymentTitle.textContent = 'Pay with USDT TRC20';
  const paymentNote = payment?.querySelector('.note');
  if (paymentNote) paymentNote.textContent = 'Pay only with USDT on Tron (TRC20). After payment, paste the TXID to verify the transfer and unlock the AI ad. No verified TXID, no full ad.';
}

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

function ensurePhotoField() {
  if ($("#photo")) return;
  const contactLabel = $("#contact")?.closest("label");
  const productLabel = $("#product")?.closest("label");
  if (!productLabel) return;
  const label = document.createElement("label");
  label.textContent = "Product photo link";
  const input = document.createElement("input");
  input.id = "photo";
  input.placeholder = "Paste product image URL, Instagram image link, or store product link";
  label.appendChild(input);
  productLabel.parentNode.insertBefore(label, contactLabel || productLabel.nextSibling);
}

function makeOrderId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `M10-${date}-${random}`;
}

function getOrderPayload() {
  return { plan: state.plan, product_name: $("#product").value.trim(), photo_url: $("#photo")?.value.trim() || "", contact: $("#contact")?.value.trim() || "", language: $("#language").value, brief: $("#brief").value.trim() };
}

function fallbackAd(payload) {
  const photoLine = payload.photo_url ? `\nVisual reference: ${payload.photo_url}\n` : "\n";
  if (payload.language === "العربية") return `العنوان: ${payload.product_name} بإعلان جاهز يلفت الانتباه${photoLine}\n${payload.brief}\n\nنص الإعلان: خلي منتجك يبين بشكل أقوى وأوضح مع إعلان سريع وجاهز للنشر. ${payload.product_name} مصمم ليجذب الانتباه ويحول المشاهد إلى عميل.\n\nالدعوة للإجراء: اطلب الآن\nالهاشتاغات: #${payload.product_name.replace(/\s+/g, "")} #اعلان #تسويق`;
  if (payload.language === "Türkçe") return `Baslik: ${payload.product_name} ile daha guclu gorunun${photoLine}\n${payload.brief}\n\nReklam metni: ${payload.product_name}, markanizi daha dikkat cekici gostermek icin hazirlandi. Hemen deneyin ve farki dakikalar icinde gorun.\n\nCTA: Simdi kesfet\nHashtags: #${payload.product_name.replace(/\s+/g, "")} #AIAds #Marketing`;
  return `Headline: Make ${payload.product_name} impossible to ignore${photoLine}\n${payload.brief}\n\nAd copy: Show your product with a clear, ready-to-post message built to catch attention fast. ${payload.product_name} is positioned as the simple choice for customers who want results without overthinking.\n\nCTA: Order now\nHashtags: #${payload.product_name.replace(/\s+/g, "")} #AIAds #Marketing`;
}

async function postJson(path, payload, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(`${API}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || data.error || "Request failed");
    return data;
  } finally { clearTimeout(timer); }
}

function copyText(text, button) {
  if (!navigator.clipboard) { window.prompt("Copy this text:", text); return; }
  navigator.clipboard.writeText(text).then(() => { const oldText = button.textContent; button.textContent = "Copied"; setTimeout(() => { button.textContent = oldText; }, 1400); }).catch(() => window.prompt("Copy this text:", text));
}

function orderDetailsText(txid = "") {
  const payload = getOrderPayload();
  return ["M10 USDT PAYMENT CONFIRMATION",`Order ID: ${state.orderId}`,`Plan: ${state.plan}`,`Amount: ${state.price.toFixed(2)} USDT`,`Network: ${NETWORK}`,`Wallet: ${WALLET_ADDRESS}`,`Customer contact: ${payload.contact}`,`Product: ${payload.product_name}`,`Photo link: ${payload.photo_url || "not provided"}`,`Language: ${payload.language}`,`Brief: ${payload.brief}`,txid ? `TXID: ${txid}` : "TXID: add after transfer",state.adUnlocked ? "" : "Generated ad: locked until payment TXID is verified",state.adUnlocked ? "Generated ad:" : "",state.adUnlocked ? state.ad : ""].join("\n");
}

function notificationText() { if (state.notified) return "Order notification sent to M10 Telegram."; return "Order created. Send USDT TRC20, then paste and verify the TXID to unlock the AI ad."; }
function renderAdSection() { const locked = !state.adUnlocked; return `<div class="generated-ad ${locked ? "locked" : ""}"><p class="eyebrow">AI AD OUTPUT</p>${state.verificationMessage ? `<p class="note">${state.verificationMessage}</p>` : ""}${locked ? `<p class="note">Your AI ad is prepared but locked. It opens only after a verified USDT TRC20 TXID.</p>` : `<pre id="adOutput"></pre><button id="copyAd" type="button">Copy AI ad</button>`}</div>`; }

function bindAdActions() {
  const unlock = $("#unlockAd");
  if (unlock) { unlock.onclick = async () => { const txid = $("#txid").value.trim(); if (!txid) { alert("Please paste the TXID after sending USDT."); return; } unlock.disabled = true; unlock.textContent = "Verifying TXID..."; try { const result = await postJson("/api/verify-tx", { txid, amount: state.price }, 12000); if (!result.verified) throw new Error(result.reason || "TXID was not verified"); state.adUnlocked = true; state.verificationMessage = "Payment TXID verified. AI ad unlocked."; } catch (error) { state.adUnlocked = false; state.verificationMessage = "TXID not verified yet. Make sure USDT was sent on Tron (TRC20) to the displayed wallet, then try again."; } finally { renderManualUsdtCheckout(); } }; }
  const adOutput = $("#adOutput"); if (adOutput) adOutput.textContent = state.ad;
  const copyAd = $("#copyAd"); if (copyAd) copyAd.onclick = () => copyText(state.ad, copyAd);
}

function renderManualUsdtCheckout() {
  let panel = $("#manualPayment"); const txidValue = $("#txid")?.value.trim() || "";
  if (!panel) { panel = document.createElement("div"); panel.id = "manualPayment"; payment.appendChild(panel); }
  panel.className = "manual-pay";
  panel.innerHTML = `<p class="eyebrow">USDT TELEGRAM WALLET</p><h3>1. Send ${state.price.toFixed(2)} USDT</h3><p class="danger">Send only USDT on Tron (TRC20) to the wallet below. Any other network may cause permanent loss.</p><div class="payment-grid"><span>Order ID</span><strong>${state.orderId}</strong><span>Network</span><strong>${NETWORK}</strong><span>Amount</span><strong>${state.price.toFixed(2)} USDT</strong></div><p class="note">${notificationText()}</p><label>Telegram Wallet address<div class="copy-row"><input id="walletAddress" readonly value="${WALLET_ADDRESS}"><button id="copyWallet" type="button">Copy</button></div></label><a class="secondary" href="https://t.me/wallet" target="_blank" rel="noopener">Open Telegram Wallet</a><label>2. Paste Transaction ID / TXID after payment<input id="txid" placeholder="Paste TXID after sending USDT" value="${txidValue}"></label><button id="unlockAd" type="button" class="primary">3. Verify TXID and unlock AI ad</button><button id="copyOrder" type="button" class="secondary">Copy payment confirmation</button><a id="telegramSupport" class="secondary" href="${TELEGRAM_SUPPORT}" target="_blank" rel="noopener">Send confirmation on Telegram</a>${renderAdSection()}<p class="note">No verified payment, no full ad. The AI ad stays locked until the TXID is confirmed.</p>`;
  $("#copyWallet").onclick = () => copyText(WALLET_ADDRESS, $("#copyWallet"));
  $("#copyOrder").onclick = () => { const txid = $("#txid").value.trim(); copyText(orderDetailsText(txid), $("#copyOrder")); };
  bindAdActions(); panel.scrollIntoView({ behavior: "smooth" });
}

async function showManualUsdtCheckout(button) {
  button.disabled = true; button.textContent = "Creating AI ad...";
  const payload = getOrderPayload(); state.orderId = makeOrderId(); state.notified = false; state.adUnlocked = false; state.verificationMessage = ""; state.ad = fallbackAd(payload);
  try { const data = await postJson("/api/order", payload, 8000); state.orderId = data.order_id || state.orderId; state.notified = Boolean(data.telegram && data.telegram.sent); if (data.ad && data.ad.content) state.ad = data.ad.content; } catch (error) { console.warn("M10 order AI fallback:", error); }
  finally { button.disabled = false; button.textContent = "₮ Pay with USDT"; renderManualUsdtCheckout(); }
}

ensureUsdtOnlyPayment();
plans.forEach((button) => { button.onclick = () => { state.plan = button.dataset.plan; state.price = Number(button.dataset.price); $("#order").classList.remove("hidden"); ensureContactField(); ensurePhotoField(); ensureUsdtOnlyPayment(); payment.classList.add("hidden"); const manualPanel = $("#manualPayment"); if (manualPanel) manualPanel.remove(); $("#orderTitle").textContent = `${state.plan} — $${state.price.toFixed(2)}`; $("#order").scrollIntoView({ behavior: "smooth" }); }; });
$("#continue").onclick = () => { ensureContactField(); ensurePhotoField(); ensureUsdtOnlyPayment(); const payload = getOrderPayload(); if (!payload.product_name || !payload.photo_url || !payload.contact || !payload.brief) { alert("Please add your product name, photo link, contact, and a short description."); return; } payment.classList.remove("hidden"); payment.scrollIntoView({ behavior: "smooth" }); };
document.querySelectorAll(".pay").forEach((button) => { button.onclick = () => { if (button.dataset.method !== "crypto") { alert("Card payment is coming soon. No charge will be made."); return; } showManualUsdtCheckout(button); }; });
