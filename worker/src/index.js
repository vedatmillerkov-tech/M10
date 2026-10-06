const H={"content-type":"application/json;charset=UTF-8","access-control-allow-origin":"*","access-control-allow-headers":"content-type","access-control-allow-methods":"GET,POST,OPTIONS"};
const PLANS={TRY:.49,START:1.49,BOOST:2.99,PRO:6.99};
const WALLET_ADDRESS="TP4DPLKPQnN4HgHHWeo9n2mCUvJR7uZwPZ";
const NETWORK="Tron (TRC20)";
const USDT_TRC20_CONTRACT="TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";

const out=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const text=v=>String(v||"").trim();
const orderId=()=>`M10-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,5).toUpperCase()}`;
const money=n=>Number(n).toFixed(6);

function uniquePaymentAmount(plan){
  const base=PLANS[plan];
  const extra=(crypto.getRandomValues(new Uint32Array(1))[0]%900+100)/1000000;
  return money(base+extra);
}

function fallbackAd({product_name,photo_url,brief,language}){
  const visual=photo_url?`\nVisual reference: ${photo_url}\n`:"\n";
  const lang=String(language||"English").toLowerCase();
  if(lang.includes("türk"))return `Baslik: ${product_name} ile daha guclu gorunun${visual}\n${brief}\n\nReklam metni: ${product_name}, gorsel urun detaylarini one cikaracak sekilde hazirlandi. Markanizi daha dikkat cekici gosterin ve musteriye hizli karar verdirecek net bir mesaj sunun.\n\nCTA: Simdi kesfet\nHashtags: #${product_name.replace(/\s+/g,"")} #AIAds #Marketing`;
  if(lang.includes("عرب"))return `العنوان: ${product_name} بإعلان جاهز يلفت الانتباه${visual}\n${brief}\n\nنص الإعلان: إعلان جاهز يبرز المنتج من الصورة والوصف بطريقة واضحة وسريعة. ${product_name} يظهر كخيار مناسب للعميل الذي يريد منتجاً ملفتاً بدون تعقيد.\n\nالدعوة للإجراء: اطلب الآن\nالهاشتاغات: #${product_name.replace(/\s+/g,"")} #اعلان #تسويق`;
  return `Headline: Make ${product_name} impossible to ignore${visual}\n${brief}\n\nAd copy: Turn the product visual into a clear, ready-to-post message built to catch attention fast. ${product_name} is positioned as the simple choice for customers who want style, clarity, and quick confidence.\n\nCTA: Order now\nHashtags: #${product_name.replace(/\s+/g,"")} #AIAds #Marketing`;
}

async function generateAd(env,input){
  if(!env.OPENAI_API_KEY)return {mode:"template",content:fallbackAd(input)};
  const prompt=`Create a ready-to-post social media ad. Product: ${input.product_name}. Product photo/reference link: ${input.photo_url||"not provided"}. Language: ${input.language}. Brief: ${input.brief}. Return: headline, ad copy, CTA, and hashtags.`;
  const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${env.OPENAI_API_KEY}`},body:JSON.stringify({model:env.OPENAI_MODEL||"gpt-4o-mini",messages:[{role:"system",content:"You write concise high-converting social ads using the provided product details and visual reference when available."},{role:"user",content:prompt}],temperature:.8})});
  if(!r.ok)return {mode:"template",content:fallbackAd(input),warning:"openai_request_failed"};
  const data=await r.json();
  return {mode:"ai",content:data.choices?.[0]?.message?.content||fallbackAd(input)};
}

function buildTelegramMessage(order){return ["New M10 order",`Order ID: ${order.id}`,`Plan: ${order.plan}`,`Amount: ${order.amount} USDT`,`Network: ${NETWORK}`,`Wallet: ${WALLET_ADDRESS}`,`Customer contact: ${order.contact}`,`Product: ${order.product_name}`,`Photo link: ${order.photo_url||"not provided"}`,`Language: ${order.language}`,`Brief: ${order.brief}`,"Status: Pending automatic USDT confirmation"].join("\n");}
async function notifyTelegram(env, order){if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID)return {sent:false,reason:"telegram_env_missing"};const url=`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:buildTelegramMessage(order)})});if(!r.ok)return {sent:false,reason:"telegram_api_error",status:r.status,body:(await r.text()).slice(0,300)};return {sent:true};}
function normalizeTxId(txid){return text(txid).replace(/^0x/i,"").toLowerCase();}
function microUsdtToNumber(value){return Number(value||0)/1_000_000;}
async function verifyTrc20Tx({txid,amount}){const clean=normalizeTxId(txid);if(!/^[a-f0-9]{64}$/.test(clean))return {verified:false,reason:"invalid_txid_format"};const url=`https://api.trongrid.io/v1/transactions/${clean}/events`;const r=await fetch(url,{headers:{"accept":"application/json"}});if(!r.ok)return {verified:false,reason:"trongrid_unavailable",status:r.status};const data=await r.json();const events=Array.isArray(data.data)?data.data:[];const required=Number(amount);for(const event of events){const contract=event.contract_address||event.contract||"";const name=event.event_name||event.event||"";const result=event.result||{};const to=result.to||result._to||"";const rawValue=result.value||result._value||result.amount;const usdt=microUsdtToNumber(rawValue);if(contract===USDT_TRC20_CONTRACT&&name.toLowerCase()==="transfer"&&to===WALLET_ADDRESS&&Math.abs(usdt-required)<0.000001)return {verified:true,asset:"USDT",network:NETWORK,amount:usdt,to,txid:clean};}return {verified:false,reason:"matching_usdt_transfer_not_found"};}

async function findIncomingPayment({amount,created_at}){
  const required=Number(amount);
  if(!required)return {verified:false,reason:"missing_amount"};
  const minTs=Math.max(0,new Date(created_at||Date.now()-3600000).getTime()-300000);
  const url=`https://api.trongrid.io/v1/accounts/${WALLET_ADDRESS}/transactions/trc20?limit=50&only_confirmed=true&contract_address=${USDT_TRC20_CONTRACT}&min_timestamp=${minTs}`;
  const r=await fetch(url,{headers:{"accept":"application/json"}});
  if(!r.ok)return {verified:false,reason:"trongrid_unavailable",status:r.status};
  const data=await r.json();
  const txs=Array.isArray(data.data)?data.data:[];
  for(const tx of txs){
    const to=tx.to||tx.to_address||"";
    const txid=tx.transaction_id||tx.txID||tx.hash||"";
    const value=microUsdtToNumber(tx.value||tx.amount);
    if(to===WALLET_ADDRESS&&Math.abs(value-required)<0.000001)return {verified:true,asset:"USDT",network:NETWORK,amount:value,to,txid,block_timestamp:tx.block_timestamp};
  }
  return {verified:false,reason:"payment_not_found_yet"};
}

export default{async fetch(req,env){
  if(req.method==="OPTIONS")return new Response(null,{headers:H});
  const u=new URL(req.url);
  if(u.pathname==="/health")return out({ok:true,service:"M10 API",version:"1.0",mode:"auto_usdt_wallet_matching"});
  if(u.pathname==="/api/generate"&&req.method==="POST"){let b;try{b=await req.json()}catch{return out({error:"invalid_json"},400)}const input={product_name:text(b.product_name),photo_url:text(b.photo_url),brief:text(b.brief),language:text(b.language)||"English"};if(!input.product_name||!input.brief)return out({error:"missing_fields",message:"product_name and brief are required"},400);return out({ad:await generateAd(env,input)});}
  if(u.pathname==="/api/verify-tx"&&req.method==="POST"){let b;try{b=await req.json()}catch{return out({error:"invalid_json"},400)}const txid=text(b.txid);const amount=Number(b.amount);if(!txid||!amount)return out({verified:false,error:"missing_fields",message:"txid and amount are required"},400);return out(await verifyTrc20Tx({txid,amount}));}
  if(u.pathname==="/api/check-payment"&&req.method==="POST"){let b;try{b=await req.json()}catch{return out({error:"invalid_json"},400)}return out(await findIncomingPayment({amount:b.amount,created_at:b.created_at}));}
  if(u.pathname==="/api/order"&&req.method==="POST"){let b;try{b=await req.json()}catch{return out({error:"invalid_json"},400)}const plan=text(b.plan).toUpperCase();if(!PLANS[plan])return out({error:"invalid_plan"},400);const input={product_name:text(b.product_name),photo_url:text(b.photo_url),contact:text(b.contact||b.customer_contact),brief:text(b.brief),language:text(b.language)||"English"};if(!input.product_name||!input.contact||!input.brief)return out({error:"missing_fields",message:"product_name, contact, and brief are required"},400);const created_at=new Date().toISOString();const amount=uniquePaymentAmount(plan);const order={id:orderId(),plan,amount,base_amount:PLANS[plan].toFixed(2),...input,created_at};const expires_at=new Date(Date.now()+24*60*60*1000).toISOString();await env.DB.prepare("INSERT INTO orders (id, plan, quoted_usd, payment_amount, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(order.id,plan,order.base_amount,order.amount,"PENDING",created_at,expires_at).run();const ad=await generateAd(env,input);const telegram=await notifyTelegram(env,order);return out({order_id:order.id,status:"PENDING_USDT",telegram,plan,payment:{asset:"USDT",network:NETWORK,amount:order.amount,receiving_address:WALLET_ADDRESS,auto_check:true},order,ad},201);}
  return out({error:"not_found"},404);
}};
