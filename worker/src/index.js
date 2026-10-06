const H={"content-type":"application/json;charset=UTF-8","access-control-allow-origin":"*","access-control-allow-headers":"content-type","access-control-allow-methods":"GET,POST,OPTIONS"};
const PLANS={TRY:.49,START:1.49,BOOST:2.99,PRO:6.99};
const WALLET_ADDRESS="TP4DPLKPQnN4HgHHWeo9n2mCUvJR7uZwPZ";
const NETWORK="Tron (TRC20)";
const USDT_TRC20_CONTRACT="TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";

const out=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const text=v=>String(v||"").trim();
const orderId=()=>`M10-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,5).toUpperCase()}`;

function fallbackAd({product_name,brief,language}){
  const lang=String(language||"English").toLowerCase();
  if(lang.includes("türk"))return `Baslik: ${product_name} ile daha guclu gorunun\n\n${brief}\n\nReklam metni: ${product_name}, markanizi daha dikkat cekici gostermek icin hazirlandi. Hemen deneyin ve farki dakikalar icinde gorun.\n\nCTA: Simdi kesfet\nHashtags: #${product_name.replace(/\s+/g,"")} #AIAds #Marketing`;
  if(lang.includes("عرب"))return `العنوان: ${product_name} بإعلان جاهز يلفت الانتباه\n\n${brief}\n\nنص الإعلان: خلي منتجك يبين بشكل أقوى وأوضح مع إعلان سريع وجاهز للنشر. ${product_name} مصمم ليجذب الانتباه ويحول المشاهد إلى عميل.\n\nالدعوة للإجراء: اطلب الآن\nالهاشتاغات: #${product_name.replace(/\s+/g,"")} #اعلان #تسويق`;
  return `Headline: Make ${product_name} impossible to ignore\n\n${brief}\n\nAd copy: Show your product with a clear, ready-to-post message built to catch attention fast. ${product_name} is positioned as the simple choice for customers who want results without overthinking.\n\nCTA: Order now\nHashtags: #${product_name.replace(/\s+/g,"")} #AIAds #Marketing`;
}

async function generateAd(env,input){
  if(!env.OPENAI_API_KEY)return {mode:"template",content:fallbackAd(input)};
  const prompt=`Create a ready-to-post social media ad. Product: ${input.product_name}. Language: ${input.language}. Brief: ${input.brief}. Return: headline, ad copy, CTA, and hashtags.`;
  const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${env.OPENAI_API_KEY}`},body:JSON.stringify({model:env.OPENAI_MODEL||"gpt-4o-mini",messages:[{role:"system",content:"You write concise high-converting social ads."},{role:"user",content:prompt}],temperature:.8})});
  if(!r.ok)return {mode:"template",content:fallbackAd(input),warning:"openai_request_failed"};
  const data=await r.json();
  return {mode:"ai",content:data.choices?.[0]?.message?.content||fallbackAd(input)};
}

function buildTelegramMessage(order){return ["New M10 order",`Order ID: ${order.id}`,`Plan: ${order.plan}`,`Amount: ${order.amount} USDT`,`Network: ${NETWORK}`,`Wallet: ${WALLET_ADDRESS}`,`Customer contact: ${order.contact}`,`Product: ${order.product_name}`,`Language: ${order.language}`,`Brief: ${order.brief}`,"Status: Pending USDT confirmation"].join("\n");}

async function notifyTelegram(env, order){
  if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID)return {sent:false,reason:"telegram_env_missing"};
  const url=`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:buildTelegramMessage(order)})});
  if(!r.ok)return {sent:false,reason:"telegram_api_error",status:r.status,body:(await r.text()).slice(0,300)};
  return {sent:true};
}

function normalizeTxId(txid){return text(txid).replace(/^0x/i,"").toLowerCase();}
function microUsdtToNumber(value){return Number(value||0)/1_000_000;}

async function verifyTrc20Tx({txid,amount}){
  const clean=normalizeTxId(txid);
  if(!/^[a-f0-9]{64}$/.test(clean))return {verified:false,reason:"invalid_txid_format"};
  const url=`https://api.trongrid.io/v1/transactions/${clean}/events`;
  const r=await fetch(url,{headers:{"accept":"application/json"}});
  if(!r.ok)return {verified:false,reason:"trongrid_unavailable",status:r.status};
  const data=await r.json();
  const events=Array.isArray(data.data)?data.data:[];
  const required=Number(amount);
  for(const event of events){
    const contract=event.contract_address||event.contract||"";
    const name=event.event_name||event.event||"";
    const result=event.result||{};
    const to=result.to||result._to||"";
    const rawValue=result.value||result._value||result.amount;
    const usdt=microUsdtToNumber(rawValue);
    if(contract===USDT_TRC20_CONTRACT&&name.toLowerCase()==="transfer"&&to===WALLET_ADDRESS&&usdt+0.000001>=required){
      return {verified:true,asset:"USDT",network:NETWORK,amount:usdt,to,txid:clean};
    }
  }
  return {verified:false,reason:"matching_usdt_transfer_not_found"};
}

export default{async fetch(req,env){
  if(req.method==="OPTIONS")return new Response(null,{headers:H});
  const u=new URL(req.url);
  if(u.pathname==="/health")return out({ok:true,service:"M10 API",version:"0.8",mode:"txid_verification"});

  if(u.pathname==="/api/generate"&&req.method==="POST"){
    let b;try{b=await req.json()}catch{return out({error:"invalid_json"},400)}
    const input={product_name:text(b.product_name),brief:text(b.brief),language:text(b.language)||"English"};
    if(!input.product_name||!input.brief)return out({error:"missing_fields",message:"product_name and brief are required"},400);
    return out({ad:await generateAd(env,input)});
  }

  if(u.pathname==="/api/verify-tx"&&req.method==="POST"){
    let b;try{b=await req.json()}catch{return out({error:"invalid_json"},400)}
    const txid=text(b.txid);
    const amount=Number(b.amount);
    if(!txid||!amount)return out({verified:false,error:"missing_fields",message:"txid and amount are required"},400);
    return out(await verifyTrc20Tx({txid,amount}));
  }

  if(u.pathname==="/api/order"&&req.method==="POST"){
    let b;try{b=await req.json()}catch{return out({error:"invalid_json"},400)}
    const plan=text(b.plan).toUpperCase();
    if(!PLANS[plan])return out({error:"invalid_plan"},400);
    const input={product_name:text(b.product_name),contact:text(b.contact||b.customer_contact),brief:text(b.brief),language:text(b.language)||"English"};
    if(!input.product_name||!input.contact||!input.brief)return out({error:"missing_fields",message:"product_name, contact, and brief are required"},400);
    const order={id:orderId(),plan,amount:PLANS[plan].toFixed(2),...input,created_at:new Date().toISOString()};
    const ad=await generateAd(env,input);
    const telegram=await notifyTelegram(env,order);
    return out({order_id:order.id,status:"PENDING_USDT",telegram,plan,payment:{asset:"USDT",network:NETWORK,amount:order.amount,receiving_address:WALLET_ADDRESS},order,ad},201);
  }
  return out({error:"not_found"},404);
}};
