import {client,unwrap} from "./customer_supabase_client.js";
import {CONFIG} from "../customer_config.js";
import {normalizePhone} from "../customer_format.js";
import {CustomerError} from "../customer_errors.js";
export async function session() { return unwrap(await client().auth.getSession()).session; }
export async function signIn(identifier,password) {
  if(identifier.includes("@")) return unwrap(await client().auth.signInWithPassword({email:identifier.trim(),password}));
  const {data,error} = await client().functions.invoke(CONFIG.phoneLoginFunction,{body:{phone:normalizePhone(identifier),password}});
  if(error) {
    let status=error.context?.status;
    throw new CustomerError(status===429?"ทำรายการถี่เกินไป กรุณารอแล้วลองใหม่":status===404?"บริการเข้าสู่ระบบด้วยเบอร์โทรศัพท์ยังไม่พร้อม กรุณาใช้อีเมล":status===401?"อีเมลหรือเบอร์โทรศัพท์และรหัสผ่านไม่ถูกต้อง":"บริการเข้าสู่ระบบขัดข้อง กรุณาลองใหม่",{status});
  }
  if(!data?.access_token || !data?.refresh_token) throw new CustomerError("ข้อมูลเข้าสู่ระบบไม่ถูกต้อง");
  return unwrap(await client().auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token}));
}
export async function signUp(values) {
  return unwrap(await client().auth.signUp({email:values.email.trim(),password:values.password,options:{
    emailRedirectTo:new URL("dashboard.html",location.href).href,
    data:{customer_module:true,name:values.name.trim(),phone:normalizePhone(values.phone)}
  }}));
}
export async function signOut() {
  unwrap(await client().auth.signOut({scope:"local"}));
  // Remove customer drafts without touching the admin's session/storage.
  for(const key of Object.keys(localStorage)) if(key.startsWith("iceflow.customer.draft.")) localStorage.removeItem(key);
}
export async function sendReset(email) { return unwrap(await client().auth.resetPasswordForEmail(email.trim(),{redirectTo:new URL("reset-password.html",location.href).href})); }
export async function changePassword(password) { return unwrap(await client().auth.updateUser({password})); }
export async function changeEmail(email) { return unwrap(await client().auth.updateUser({email:email.trim(),options:{emailRedirectTo:new URL("profile.html",location.href).href}})); }

