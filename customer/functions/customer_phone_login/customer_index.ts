import {createClient} from "https://esm.sh/@supabase/supabase-js@2.49.8";

const env=(name:string)=>Deno.env.get(name)??"";
const url=env("SUPABASE_URL"),key=env("SUPABASE_ANON_KEY");
const service=env("SUPABASE_SERVICE_ROLE_KEY");
const origins=env("CUSTOMER_ALLOWED_ORIGINS").split(",").map(s=>s.trim()).filter(Boolean);
const salt=env("CUSTOMER_LOGIN_RATE_SALT");
const options={auth:{persistSession:false,autoRefreshToken:false}};
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,"0")).join("");

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")??"";
  const headers={"Content-Type":"application/json","Cache-Control":"no-store",
    "Vary":"Origin","Access-Control-Allow-Origin":origins.includes(origin)?origin:"",
    "Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type",
    "Access-Control-Allow-Methods":"POST,OPTIONS"};
  const reply=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers});
  if(!origin||!origins.includes(origin))return reply(403,{error:"Origin not allowed"});
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return reply(405,{error:"Method not allowed"});
  if(!url||!key||!service||!salt)return reply(503,{error:"Login unavailable"});
  if(Number(req.headers.get("content-length")??0)>4096)return reply(400,{error:"Invalid credentials"});
  try{
    const raw=await req.text();if(raw.length>4096)return reply(400,{error:"Invalid credentials"});
    const body=JSON.parse(raw);
    const phone=String(body.phone??"").replace(/[\s()-]/g,"").replace(/^\+66/,"0");
    const password=String(body.password??"");
    if(!/^0\d{8,9}$/.test(phone)||!password||password.length>128)return reply(401,{error:"Invalid credentials"});
    const admin=createClient(url,service,options);
    // Never return the lookup email or use the admin client to authenticate a password.
    const ip=req.headers.get("x-forwarded-for")?.split(",")[0].trim()??"unknown";
    const [phoneLimit,ipLimit]=await Promise.all([
      admin.rpc("customer_phone_rate_limit_v2",{p_key:await hash(salt+"phone:"+phone),p_max:5}),
      admin.rpc("customer_phone_rate_limit_v2",{p_key:await hash(salt+"ip:"+ip),p_max:30})
    ]);
    if(phoneLimit.error||ipLimit.error)return reply(503,{error:"Login unavailable"});
    if(!phoneLimit.data||!ipLimit.data)return reply(429,{error:"Too many attempts"});
    const lookup=await admin.rpc("customer_phone_credentials_v2",{p_phone:phone});
    if(lookup.error)return reply(503,{error:"Login unavailable"});
    const auth=createClient(url,key,options);
    // Execute password verification even when lookup misses; keep failures indistinguishable.
    const result=await auth.auth.signInWithPassword({email:lookup.data??"customer-no-account@invalid.invalid",password});
    if(!lookup.data||result.error||!result.data.session)return reply(401,{error:"Invalid credentials"});
    const s=result.data.session;
    return reply(200,{access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at});
  }catch{return reply(401,{error:"Invalid credentials"});}
});
