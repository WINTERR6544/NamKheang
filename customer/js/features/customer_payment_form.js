import {$,heading,card,field,button,orderSummary,checkbox,confirm,busy,banner,toast,icon} from "../components/customer_ui.js";
import {bindValidation,validators} from "../components/customer_validation.js";
import {getOrder} from "../services/customer_order_service.js";
import {uploadSlip,submitPayment,discardSlip} from "../services/customer_payment_service.js";
import {balance,money,esc,todayBangkok,orderUrl} from "../customer_format.js";
import {CONFIG} from "../customer_config.js";
import {MAX_SLIP_BYTES,SLIP_TYPES} from "../customer_constants.js";
import {errorMessage} from "../customer_errors.js";
export async function render(context,el){
  const d=await getOrder(context.orderId,context.profile.customer_id),type=context.page==="deposit"?"deposit":"final";
  const q=d.quote,amount=type==="deposit"?Number(q?.deposit_amount):balance(q,d.payments);
  el.innerHTML=heading(type==="deposit"?"ชำระมัดจำ":"ชำระยอดคงเหลือ","โอนเงินตามยอดที่ระบุ แล้วแนบหลักฐานเพื่อให้ร้านตรวจสอบ")+orderSummary(d.o);
  const submitted=d.payments.find(p=>p.pay_type===type);
  if(submitted){el.innerHTML+=card(submitted.verified?"ตรวจสอบการชำระแล้ว":"รอร้านตรวจสอบ",'<p>ยอด '+money(submitted.amount)+'</p><p>ส่งหลักฐานแล้ว ไม่ต้องส่งซ้ำ</p>'+button("ดูรายการชำระเงิน","payments.html","ghost"));return;}
  if(!q||d.o.status!==(type==="deposit"?1:9)||type==="deposit"&&(q.status!=="accepted"||q.valid_until<todayBangkok())||type==="final"&&(!d.acceptance.at(-1)?.passed||new Date(d.acceptance.at(-1)?.checked_at)<new Date(d.o.installed_at))){
    el.innerHTML+=card("ยังไม่สามารถชำระเงินขั้นนี้",'<p>กรุณาตรวจสอบสถานะ ยืนยันใบเสนอราคา หรือยืนยันตรวจรับก่อนชำระ</p>'+button("กลับไปคำสั่งซื้อ",orderUrl("order",d.o.order_id),"ghost"));return;
  }
  el.innerHTML+=card("",'<div class="row between"><div><p>ยอด'+(type==="deposit"?"มัดจำ":"คงเหลือ")+'ตามใบเสนอราคา</p><strong class="amount">'+money(amount)+'</strong></div><dl class="summary-dl"><dt>ยอดรวม</dt><dd>'+money(q.total_price)+'</dd><dt>มัดจำ</dt><dd>'+money(q.deposit_amount)+'</dd></dl></div>',"tint")+
    '<div class="grid cols2" style="margin-top:18px">'+card("1. เลือกช่องทางชำระเงิน",'<p class="muted small">เลือกรูปแบบในฟอร์มหลักฐานด้านขวา</p>'+
      (CONFIG.bank.accountNumber?'<dl class="summary-dl"><dt>ธนาคาร</dt><dd>'+esc(CONFIG.bank.name)+'</dd><dt>ชื่อบัญชี</dt><dd>'+esc(CONFIG.bank.accountName)+'</dd><dt>เลขบัญชี</dt><dd>'+esc(CONFIG.bank.accountNumber)+'</dd></dl>':'<div class="banner warning">กรุณาขอข้อมูลบัญชีธนาคารหรือ QR ที่ยืนยันแล้วจากร้านก่อนโอนเงิน</div>')+
      (CONFIG.bank.qrImage?'<img class="file-preview" src="'+esc(CONFIG.bank.qrImage)+'" alt="QR ชำระเงินของร้าน">':"")+
      '<div class="rule"></div><p class="small">สถานะชำระเงินจะเปลี่ยนเมื่อร้านตรวจสอบยอดและหลักฐานแล้ว</p>')+
    '<form class="card" id="payment-form" novalidate><h2>2. แนบหลักฐานการชำระเงิน</h2>'+field("method","ช่องทางชำระเงิน",{value:"transfer",options:[{value:"transfer",label:"โอนผ่านธนาคาร"},{value:"qr",label:"QR / PromptPay"},{value:"cash",label:"เงินสดที่ร้าน"}]})+
    '<div class="grid cols2">'+field("paid_date","วันที่ชำระ",{type:"date",required:true,value:todayBangkok()})+field("paid_time","เวลาชำระ",{type:"time",required:true})+'</div>'+field("amount","จำนวนเงินที่ชำระ (บาท)",{type:"number",value:amount.toFixed(2),readonly:true})+
    '<div class="field" id="slip-field"><label for="slip">หลักฐาน JPG, PNG หรือ PDF *</label><div class="file-drop">'+icon("imgCamera","231:6699")+'<p>เลือกไฟล์หลักฐานการชำระเงิน</p><input id="slip" type="file" name="slip" accept="image/jpeg,image/png,application/pdf" aria-describedby="slip-error"><p class="upload-note">ขนาดไม่เกิน 10 MB</p><div id="preview"></div></div><p id="slip-error" class="field-error" data-error="slip" hidden></p></div>'+
    checkbox("confirmed","ตรวจสอบยอด วันที่ และหลักฐานว่าถูกต้องแล้ว")+'<div data-banner hidden role="alert"></div><button class="btn block" type="submit">ส่งหลักฐานการชำระเงิน</button></form></div>';
  const form=$("#payment-form");let file=null,objectUrl=null;
  const validation=bindValidation(form,{paid_date:v=>v&&v<=todayBangkok()?"":"กรุณาระบุวันที่ไม่เกินวันนี้",paid_time:v=>v?"":"กรุณาระบุเวลาชำระ",confirmed:v=>v?"":"กรุณายืนยันความถูกต้อง"});
  form.elements.method.onchange=()=>{$("#slip-field").hidden=form.elements.method.value==="cash";};
  $("#slip").onchange=()=>{
    if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;file=$("#slip").files[0]??null;
    const error=file&&(!SLIP_TYPES.includes(file.type)||file.size>MAX_SLIP_BYTES||!file.size)?"กรุณาเลือก JPG, PNG หรือ PDF ขนาดไม่เกิน 10 MB":"";
    $("#slip-error").textContent=error;$("#slip-error").hidden=!error;
    $("#slip").setAttribute("aria-invalid",String(Boolean(error)));
    if(error){file=null;$("#preview").innerHTML="";return;}
    $("#preview").innerHTML=file?'<div class="file-info"><span>'+esc(file.name)+' · '+(file.size/1024/1024).toFixed(2)+' MB</span><button type="button" class="text-btn" id="remove-file">ลบ</button></div>':"";
    if(file?.type.startsWith("image/")){objectUrl=URL.createObjectURL(file);const img=document.createElement("img");img.className="file-preview";img.src=objectUrl;img.alt="ตัวอย่างหลักฐาน";$("#preview").prepend(img);}
    if($("#remove-file"))$("#remove-file").onclick=()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;file=null;$("#slip").value="";$("#preview").innerHTML="";};
  };
  window.addEventListener("pagehide",()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);},{once:true});
  form.onsubmit=async e=>{
    e.preventDefault();if(!validation.validate())return;
    const v=validation.values();if(v.method!=="cash"&&!file){$("#slip-error").textContent="กรุณาแนบหลักฐานการชำระ";$("#slip-error").hidden=false;$("#slip").focus();return;}
    const paidAt=new Date(v.paid_date+"T"+v.paid_time+":00+07:00");
    if(paidAt>new Date(Date.now()+300000)){banner(form,"วันที่และเวลาชำระต้องไม่อยู่ในอนาคต");return;}
    if(!await confirm("ส่งหลักฐานการชำระเงิน?","ยอด "+money(amount)+" ร้านจะตรวจสอบก่อนยืนยันการชำระ",{label:"ส่งหลักฐาน"}))return;
    await busy(form,async()=>{let path=null;try{
      if(v.method!=="cash")path=await uploadSlip(file,context.profile.auth_id,d.o.order_id);
      await submitPayment({orderId:d.o.order_id,type,method:v.method,path,amount,paidAt:paidAt.toISOString()});
      toast("ส่งหลักฐานแล้ว รอร้านตรวจสอบ");location.replace(orderUrl("order",d.o.order_id));
    }catch(error){if(path){try{await discardSlip(path);}catch{/* Keep the payment error visible even when cleanup fails. */}}banner(form,errorMessage(error));}});
  };
}

