import {$,heading,card,field,checkbox,orderSummary,button,confirm,busy,banner,toast} from "../components/customer_ui.js";
import {bindValidation,validators} from "../components/customer_validation.js";
import {getOrder} from "../services/customer_order_service.js";
import {saveRefundAccount} from "../services/customer_payment_service.js";
import {showSlip} from "./customer_payments.js";
import {esc,money,date,normalizePhone,orderUrl} from "../customer_format.js";
import {errorMessage} from "../customer_errors.js";
export async function render(context,el){
  const d=await getOrder(context.orderId,context.profile.customer_id),r=d.payments.find(p=>p.pay_type==="refund");
  el.innerHTML=heading("คืนเงินและบัญชีรับเงินคืน","ระบุบัญชีรับคืน ติดตามความคืบหน้า และดูหลักฐานเมื่อร้านโอนเงินแล้ว")+orderSummary(d.o);
  if(!r){el.innerHTML+=card("ไม่มีรายการคืนมัดจำ","<p>รายการคืนเงินจะสร้างหลังยกเลิกออเดอร์ที่มีมัดจำผ่านการตรวจสอบ</p>");return;}
  let account={};try{account=JSON.parse(r.refund_account||"{}");}catch{account={legacy:r.refund_account};}
  el.innerHTML+=card("",'<p>ยอดคืนตามรายการที่ร้านบันทึก</p><strong class="amount">'+money(r.amount)+'</strong>',"tint")+'<div class="grid cols2" style="margin-top:18px">'+
    '<form id="refund-form" class="card" novalidate><h2>บัญชีรับเงินคืน</h2>'+field("bank","ธนาคาร",{value:account.bank||"",required:true,maxLength:120})+field("account_name","ชื่อบัญชี",{value:account.name||context.profile.name,required:true,maxLength:120})+field("account_number","เลขบัญชี",{value:account.number||"",required:true,maxLength:30})+field("branch","สาขา (ถ้ามี)",{value:account.branch||"",maxLength:120})+field("phone","เบอร์โทรศัพท์ติดต่อ",{type:"tel",value:account.phone||context.profile.phone,required:true,maxLength:20})+
    checkbox("confirmed","ตรวจสอบชื่อและเลขบัญชีรับเงินคืนว่าถูกต้องแล้ว")+
    (account.legacy?'<div class="banner warning">บัญชีเดิม: '+esc(account.legacy)+'</div>':"")+'<div data-banner hidden role="alert"></div>'+(r.verified?'<p class="banner success">คืนเงินแล้ว ข้อมูลบัญชีไม่สามารถแก้ไขได้</p>':'<button type="submit" class="btn block">ยืนยันบัญชีรับเงินคืน</button>')+'</form>'+
    card(r.verified?"ร้านโอนเงินคืนแล้ว":"รอดำเนินการคืนเงิน",'<span class="badge '+(r.verified?"success":"warning")+'">'+(r.verified?"คืนเงินแล้ว":"รอร้านโอนคืน")+'</span><div class="rule"></div><dl class="summary-dl"><dt>จำนวนเงิน</dt><dd>'+money(r.amount)+'</dd><dt>วันที่บันทึก</dt><dd>'+date(r.paid_at,true)+'</dd></dl>'+
      (r.verified&&r.slip_path?'<div class="actions"><button class="btn block" id="refund-slip">ดูหลักฐานการโอนคืน</button></div>':'<div class="banner warning">หลักฐานจะแสดงเมื่อร้านโอนเงินและบันทึกการคืนเงินแล้ว</div>'))+'</div>';
  const form=$("#refund-form");
  if(r.verified){form.querySelectorAll("input").forEach(i=>i.disabled=true);}
  else{
    const validation=bindValidation(form,{bank:v=>validators.required(v,"ธนาคาร"),account_name:validators.name,account_number:validators.account,phone:validators.phone,confirmed:v=>v?"":"กรุณายืนยันความถูกต้องของบัญชี"});
    form.onsubmit=async e=>{e.preventDefault();if(!validation.validate())return;if(!await confirm("ยืนยันบัญชีรับเงินคืน?","ร้านจะใช้ข้อมูลนี้ในการโอนเงินคืน กรุณาตรวจสอบเลขบัญชี",{label:"บันทึกบัญชี"}))return;
      await busy(form,async()=>{try{const v=validation.values();v.phone=normalizePhone(v.phone);await saveRefundAccount(r.payment_id,v);toast("บันทึกบัญชีแล้ว");context.reload();}catch(error){banner(form,errorMessage(error));}});
    };
  }
  if($("#refund-slip"))$("#refund-slip").onclick=()=>showSlip(r.slip_path);
}

