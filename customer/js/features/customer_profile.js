import {$,field,card,heading,modal,confirm,busy,banner,toast,icon} from "../components/customer_ui.js";
import {bindValidation,validators} from "../components/customer_validation.js";
import {esc,initials,normalizePhone} from "../customer_format.js";
import {getProfile,saveProfile} from "../services/customer_profile_service.js";
import {changeEmail} from "../services/customer_auth_service.js";
import {errorMessage} from "../customer_errors.js";
function details(profile) {
  return '<div class="profile-details"><div class="row"><span class="avatar">'+esc(initials(profile.name))+'</span><div><h2>'+esc(profile.name)+'</h2><p class="muted">'+esc(profile.company||"บัญชีลูกค้า")+'</p><span class="badge">บัญชีใช้งานอยู่</span></div></div><div class="rule"></div><dl class="summary-dl">'+[["ชื่อ–นามสกุล",profile.name],["เบอร์โทรศัพท์",profile.phone],["อีเมล",profile.email],["บริษัท / องค์กร",profile.company||"ยังไม่ระบุ"],["ที่อยู่ติดต่อ",profile.contact_address||"ยังไม่ระบุ"]].map(([k,v])=>'<dt>'+k+'</dt><dd>'+esc(v)+'</dd>').join("")+'</dl><button type="button" class="btn block" data-edit>'+icon("imgPencil","236:13997")+'แก้ไขข้อมูล</button></div>';
}
export async function openProfile(context) {
  await modal("ข้อมูลส่วนตัวและการติดต่อ",card("",details(context.profile)),{onOpen:dialog=>{
    $("[data-edit]",dialog).onclick=()=>{dialog.querySelector(".close").click();location.href="profile.html?edit=1";};
  }});
}
export async function render(context,el) {
  let profile=await getProfile();context.profile=profile;
  el.innerHTML=heading("ข้อมูลส่วนตัวและการติดต่อ","จัดการข้อมูลสำหรับติดต่อและประสานงาน")+card("",details(profile));
  $("[data-edit]",el).onclick=edit;
  if(new URLSearchParams(location.search).get("edit")==="1"){history.replaceState(null,"","profile.html");edit();}
  function edit(){
    el.innerHTML=heading("แก้ไขข้อมูลลูกค้า","บันทึกเฉพาะข้อมูลในบัญชีของคุณ")+'<form id="profile-form" class="card" novalidate>'+field("name","ชื่อ–นามสกุล",{value:profile.name,required:true,autocomplete:"name",maxLength:120})+'<div class="grid cols2">'+field("phone","เบอร์โทรศัพท์",{value:profile.phone,required:true,type:"tel",autocomplete:"tel",maxLength:20})+field("email","อีเมล",{value:profile.email,required:true,type:"email",autocomplete:"email",maxLength:254})+'</div>'+field("company","บริษัท / องค์กร",{value:profile.company||"",maxLength:200})+field("contact_address","ที่อยู่ติดต่อ",{value:profile.contact_address||"",type:"textarea",required:true})+'<p class="muted small">หากเปลี่ยนอีเมล กรุณายืนยันผ่านลิงก์ในอีเมลก่อนใช้อีเมลใหม่เข้าสู่ระบบ</p><div data-banner hidden role="alert"></div><div class="actions"><button type="button" class="btn ghost" id="discard">ยกเลิก</button><button type="submit" class="btn">บันทึกข้อมูล</button></div></form>';
    const form=$("#profile-form"),validation=bindValidation(form,{name:validators.name,phone:validators.phone,email:validators.email,contact_address:validators.address});
    $("#discard").onclick=async()=>{if(await confirm("ยกเลิกการแก้ไข?","ข้อมูลที่ยังไม่บันทึกจะถูกทิ้ง",{label:"ยกเลิกการแก้ไข"}))render(context,el);};
    form.onsubmit=async e=>{
      e.preventDefault();if(!validation.validate())return;
      const v=validation.values();v.phone=normalizePhone(v.phone);
      if(!await confirm("บันทึกข้อมูลลูกค้า?","ข้อมูลติดต่อใหม่จะใช้สำหรับประสานงานคำสั่งซื้อ",{label:"บันทึก"}))return;
      await busy(form,async()=>{try{
        await saveProfile(v);
        if(v.email.trim()!==profile.email){await changeEmail(v.email);toast("บันทึกข้อมูลแล้ว กรุณายืนยันการเปลี่ยนอีเมลจากกล่องจดหมาย");}
        else toast("บันทึกข้อมูลแล้ว");
        profile=await getProfile();context.profile=profile;await render(context,el);
      }catch(error){banner(form,errorMessage(error));if(error.code==="23505")validation.error("phone",errorMessage(error));}});
    };
  }
}

