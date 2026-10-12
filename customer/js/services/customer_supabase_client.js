import {CONFIG} from "../customer_config.js";
import {CustomerError} from "../customer_errors.js";
let instance;
export function client() {
  if(instance) return instance;
  if(!window.supabase?.createClient) throw new CustomerError("โหลดบริการเข้าสู่ระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วโหลดหน้าใหม่");
  // Select storage at write time so changing Remember me needs no reload.
  const chosen=()=>localStorage.getItem("iceflow.customer.remember")==="no"?sessionStorage:localStorage;
  const storage={getItem:key=>chosen().getItem(key),setItem:(key,value)=>{const other=chosen()===localStorage?sessionStorage:localStorage;other.removeItem(key);chosen().setItem(key,value);},removeItem:key=>{localStorage.removeItem(key);sessionStorage.removeItem(key);}};
  instance = window.supabase.createClient(CONFIG.supabaseUrl,CONFIG.publishableKey,{
    auth:{storageKey:"iceflow.customer.auth",storage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  return instance;
}
export const unwrap = response => {
  if(response.error) throw Object.assign(response.error,{status:response.status ?? response.error.status});
  return response.data;
};
export const customerRpc = async (name,args={}) => unwrap(await client().rpc(name,args));

