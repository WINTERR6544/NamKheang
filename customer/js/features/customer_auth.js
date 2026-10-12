import {$,field,checkbox,banner,busy,toast,confirm,icon} from "../components/customer_ui.js";
import {bindValidation,validators} from "../components/customer_validation.js";
import {signIn,signUp,sendReset,changePassword,session,signOut} from "../services/customer_auth_service.js";
import {errorMessage} from "../customer_errors.js";
import {ASSETS} from "../customer_assets.js";
import {esc} from "../customer_format.js";
const passwordField=(name,label)=>field(name,label,{type:"password",required:true,autocomplete:name==="password"?"current-password":"new-password",maxLength:128}).replace('<input','<div class="password-wrap"><input').replace('<p id=','<button type="button" class="icon-btn reveal" aria-label="แสดงรหัสผ่าน">'+icon("imgEyeOff","49:2594")+'</button></div><p id=');
export async function renderAuth(page) {
  const register=page==="sign-up",reset=page==="reset-password";
  const auth=await session();
  // Recovery token is handled by Supabase before the password-update form is shown.
  const recovery=reset&&auth&&(/type=recovery/.test(location.hash)||sessionStorage.getItem("iceflow.customer.recovery")==="yes");
  if(auth&&!reset) {location.replace("dashboard.html");return;}
  const title=register?"สร้างบัญชี":reset?(recovery?"ตั้งรหัสผ่านใหม่":"ลืมรหัสผ่าน"):"ยินดีต้อนรับกลับ";
  document.body.className="auth-body";document.title=title+" · ICEFLOW";
  const assets=ASSETS[register?"56:403":"49:2594"];
  $("#app").innerHTML='<div class="auth-shell"><section class="auth-art"><a class="brand" href="index.html"><span class="brand-mark">'+icon("imgIceMachineSymbol","49:2594")+'</span><span><b>ICEFLOW</b><small>ICE MACHINE CRM</small></span></a><img class="auth-snow one" src="'+assets.imgEvcpPresent11+'" alt=""><img class="auth-snow two" src="'+assets.imgEvcpPresent11+'" alt=""></section><main class="auth-area"><div class="auth-top"><a href="index.html">← กลับหน้าหลัก</a></div><form class="auth-card" id="auth-form" novalidate><h1>'+title+'</h1><p class="muted">'+(reset?"ส่งลิงก์กู้คืนบัญชีไปยังอีเมลของคุณ":"จัดการคำสั่งซื้อและติดตามการผลิตได้ในที่เดียว")+'</p>'+
    (register?field("name","ชื่อ–นามสกุล",{required:true,autocomplete:"name",maxLength:120})+field("phone","เบอร์โทรศัพท์",{type:"tel",required:true,autocomplete:"tel",maxLength:20}):"")+
    (!recovery?field(register||reset?"email":"identifier",register||reset?"อีเมล":"อีเมลหรือเบอร์โทรศัพท์",{type:register||reset?"email":"text",required:true,autocomplete:"username",placeholder:"name@company.co.th",maxLength:254}):"")+
    (!reset||recovery?passwordField("password","รหัสผ่าน"):"")+
    (register||recovery?passwordField("confirm_password","ยืนยันรหัสผ่าน"):"")+
    (!register&&!reset?'<div class="auth-options">'+checkbox("remember","จดจำการเข้าสู่ระบบ",localStorage.getItem("iceflow.customer.remember")!=="no")+'<a href="reset-password.html">ลืมรหัสผ่าน?</a></div>':"")+
    '<div data-banner hidden role="alert"></div><button type="submit" class="btn block">'+(register?"สมัครสมาชิก":reset?(recovery?"บันทึกรหัสผ่าน":"ส่งลิงก์กู้คืนบัญชี"):"เข้าสู่ระบบ")+'</button><div class="rule"></div><p class="auth-switch">'+(register?'มีบัญชีแล้ว? <a href="login.html">เข้าสู่ระบบ</a>':'ยังไม่มีบัญชี? <a href="sign-up.html">สมัครสมาชิก</a>')+'</p></form></main></div>';
  const form=$("#auth-form"),rules={};
  if(register){rules.name=validators.name;rules.phone=validators.phone;}
  if(register||reset&&!recovery)rules.email=validators.email;
  if(!register&&!reset)rules.identifier=v=>String(v).includes("@")?validators.email(v):validators.phone(v);
  if(!reset||recovery)rules.password=register||recovery?validators.password:v=>validators.required(v,"รหัสผ่าน");
  if(register||recovery)rules.confirm_password=(v,values)=>v===values.password?"":"รหัสผ่านทั้งสองช่องไม่ตรงกัน";
  const validation=bindValidation(form,rules);
  form.querySelectorAll(".reveal").forEach(b=>b.onclick=()=>{const input=b.previousElementSibling;const show=input.type==="password";input.type=show?"text":"password";b.setAttribute("aria-label",show?"ซ่อนรหัสผ่าน":"แสดงรหัสผ่าน");});
  form.onsubmit=async e=>{
    e.preventDefault();if(!validation.validate())return;banner(form,"");
    const v=validation.values();
    await busy(form,async()=>{
      try{
        if(reset){
          if(recovery){await changePassword(v.password);sessionStorage.removeItem("iceflow.customer.recovery");await signOut();location.replace("login.html?reset=success");}
          else {await sendReset(v.email);banner(form,"หากอีเมลนี้มีบัญชี ระบบจะส่งลิงก์กู้คืนให้ กรุณาตรวจสอบกล่องจดหมาย","success");}
        }else if(register){
          if(!await confirm("ยืนยันสมัครสมาชิก","ตรวจสอบชื่อ เบอร์โทรศัพท์ และอีเมลก่อนสร้างบัญชี",{label:"สร้างบัญชี"}))return;
          const data=await signUp(v);
          if(data.session)location.replace("dashboard.html");
          else banner(form,"สมัครสมาชิกแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ","success");
        }else{
          localStorage.setItem("iceflow.customer.remember",v.remember?"yes":"no");
          await signIn(v.identifier,v.password);location.replace("dashboard.html");
        }
      }catch(error){const text=errorMessage(error);banner(form,text);if(error.code==="23505"&&/phone/i.test(error.message))validation.error("phone",text);}
    });
  };
  if(new URLSearchParams(location.search).get("reset")==="success")banner(form,"ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบ","success");
}
export function renderLanding() {
  document.body.className="landing-body";
  const a=ASSETS["47:2"];
  const snowPositions=window.innerWidth<560?[["-45px","150px",90,92],["calc(100% - 30px)","290px",72,74],["calc(100% - 88px)","86px",58,60],["15px","500px",65,66]]:[["166px","218px",123,125],["270px","475px",104,107],["calc(100% - 138px)","414px",104,107],["calc(100% - 242px)","142px",123,125],["291px","101px",61,62],["32%","187px",61,62],["67%","86px",49,50],["calc(100% - 61px)","281px",61,62]];
  $("#app").innerHTML='<main class="landing"><a class="brand" href="index.html"><span class="brand-mark">'+icon("imgIceMachineSymbol","47:2")+'</span><span><b>ICEFLOW</b><small>ICE MACHINE CRM</small></span></a>'+snowPositions.map(([left,top,w,h])=>'<img class="landing-snow" src="'+a.imgEvcpPresent12+'" alt="" style="left:'+left+';top:'+top+';width:'+w+'px;height:'+h+'px">').join("")+'<div class="landing-copy"><h1>ICE MACHINE FLOW CRM PLATFORM</h1><p class="tagline">Precision Management, Fast Delivery</p><a class="btn" href="login.html">'+icon("imgLogIn","47:2")+'เข้าสู่ระบบ</a><small>หากยังไม่มีบัญชี&nbsp; <a href="sign-up.html">สมัครสมาชิก</a></small></div><img class="landing-orbit one" src="'+a.imgEllipse7+'" alt=""><img class="landing-orbit two" src="'+a.imgEllipse8+'" alt=""></main>';
}

