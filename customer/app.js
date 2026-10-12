import {$,loading,errorState,toast} from "./js/components/customer_ui.js";
import {layout} from "./js/components/customer_layout.js";
import {session,signOut} from "./js/services/customer_auth_service.js";
import {client} from "./js/services/customer_supabase_client.js";
import {getProfile} from "./js/services/customer_profile_service.js";
import {TITLES} from "./js/customer_constants.js";
const FEATURES={receipt:"customer_receipt",dashboard:"customer_dashboard",orders:"customer_orders",catalog:"customer_new_order","new-order":"customer_new_order",order:"customer_order",quotation:"customer_quotation",deposit:"customer_payment_form",appointment:"customer_appointment",acceptance:"customer_acceptance","final-payment":"customer_payment_form","cancel-order":"customer_cancel",refund:"customer_refund",payments:"customer_payments",notifications:"customer_notifications",profile:"customer_profile"};
const page=document.body.dataset.page;
let booted=false,accountId;
async function boot(){
  try{
    if(page==="index"){(await import("./js/features/customer_auth.js")).renderLanding();return;}
    const auth=await session();
    if(["login","sign-up","reset-password"].includes(page)){await (await import("./js/features/customer_auth.js")).renderAuth(page);return;}
    if(!auth){location.replace("login.html");return;}
    const profile=await getProfile();accountId=profile.auth_id;layout(profile,page);
    document.title=(TITLES[page]??"ลูกค้า")+" · ICEFLOW";
    const context={page,profile,orderId:new URLSearchParams(location.search).get("id")};
    let generation=0;
    context.reload=async()=>{
      const token=++generation,view=$("#view");view.innerHTML=loading();
      try{const feature=await import("./js/features/"+FEATURES[page]+".js");if(token!==generation)return;await feature.render(context,view);}
      catch(error){if(token===generation)view.replaceChildren(errorState(error,context.reload));}
    };
    await context.reload();booted=true;
    window.addEventListener("customer:profile",async()=>{try{await (await import("./js/features/customer_profile.js")).openProfile(context);}catch(error){toast("โหลดข้อมูลส่วนตัวไม่ได้ กรุณาลองใหม่","error");}});
    window.addEventListener("pageshow",e=>{if(e.persisted)location.reload();});
  }catch(error){
    const state=errorState(error,()=>location.reload());$("#app").replaceChildren(state);
    if(!["index","login","sign-up","reset-password"].includes(page)){
      const leave=document.createElement("button");leave.className="btn ghost";leave.textContent="ออกจากระบบ / ใช้บัญชีอื่น";
      leave.onclick=async()=>{try{await signOut();location.replace("login.html");}catch{toast("ออกจากระบบไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ","error");}};
      state.append(leave);
    }
  }
}
try{
  client().auth.onAuthStateChange((event,next)=>{
    if(event==="SIGNED_IN"&&booted&&next?.user.id!==accountId)location.reload();
    if(event==="PASSWORD_RECOVERY"){sessionStorage.setItem("iceflow.customer.recovery","yes");if(page!=="reset-password")location.replace("reset-password.html");}
    if(event==="SIGNED_OUT"&&booted)location.replace("login.html");
  });
}catch{ /* boot() shows a recoverable SDK/network error. */ }
window.addEventListener("offline",()=>toast("อินเทอร์เน็ตขาดการเชื่อมต่อ","error"));
boot();
