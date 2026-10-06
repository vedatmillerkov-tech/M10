const H={"content-type":"application/json;charset=UTF-8","access-control-allow-origin":"*","access-control-allow-headers":"content-type","access-control-allow-methods":"GET,POST,OPTIONS"};
const PLANS={TRY:.49,START:1.49,BOOST:2.99,PRO:6.99};
const WALLET_ADDRESS="TP4DPLKPQnN4HgHHWeo9n2mCUvJR7uZwPZ";
const NETWORK="Tron (TRC20)";

const out=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const text=v=>String(v||"").trim();
const orderId=()=>`M10-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,5).toUpperCase()}`;

function buildTelegramMessage(order){
  return [
    "New M10 order",
    `Order ID: ${order.id}`,
    `Plan: ${order.plan}`,
    `Amount: ${order.amount} USDT`,
    `Network: ${NETWORK}`,
    `Wallet: ${WALLET_ADDRESS}`,
    `Customer contact: ${order.contact}`,
    `Product: ${order.product_name}`,
    `Language: ${order.language}`,
    `Brief: ${order.brief}`,
    "Status: Pending USDT confirmation"
  ].join("\n");
}

async function notifyTelegram(env, order){
  if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID){
    return {sent:false,reason:"telegram_env_missing"};
  }
  const url=`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:buildTelegramMessage(order)})});
  if(!r.ok){
    const body=await r.text();
    return {sent:false,reason:"telegram_api_error",status:r.status,body:body.slice(0,300)};
  }
  return {sent:true};
}

export default{async fetch(req,env){
  if(req.method==="OPTIONS")return new Response(null,{headers:H});
  const u=new URL(req.url);
  if(u.pathname==="/health")return out({ok:true,service:"M10 API",version:"0.6",mode:"telegram_order_notify"});

  if(u.pathname==="/api/order"&&req.method==="POST"){
    let b;
    try{b=await req.json()}catch{return out({error:"invalid_json"},400)}
    const plan=text(b.plan).toUpperCase();
    if(!PLANS[plan])return out({error:"invalid_plan"},400);
    const product_name=text(b.product_name);
    const contact=text(b.contact||b.customer_contact);
    const brief=text(b.brief);
    const language=text(b.language)||"English";
    if(!product_name||!contact||!brief)return out({error:"missing_fields",message:"product_name, contact, and brief are required"},400);

    const order={id:orderId(),plan,amount:PLANS[plan].toFixed(2),product_name,contact,brief,language,created_at:new Date().toISOString()};
    const telegram=await notifyTelegram(env,order);

    return out({
      order_id:order.id,
      status:"PENDING_USDT",
      telegram,
      plan,
      payment:{asset:"USDT",network:NETWORK,amount:order.amount,receiving_address:WALLET_ADDRESS},
      order
    },201);
  }

  return out({error:"not_found"},404);
}};
