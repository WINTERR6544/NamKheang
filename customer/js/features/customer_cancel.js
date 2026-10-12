import {$,heading,card,field,checkbox,orderSummary,button,confirm,busy,banner} from "../components/customer_ui.js";
import {bindValidation,validators} from "../components/customer_validation.js";
import {getOrder,cancelOrder} from "../services/customer_order_service.js";
import {CANCELLABLE} from "../customer_constants.js";
import {esc,money,orderUrl} from "../customer_format.js";
import {errorMessage} from "../customer_errors.js";
export async function render(context,el){
  const d=await getOrder(context.orderId,context.profile.customer_id);
  el.innerHTML=heading("ยกเลิกคำสั่งซื้อ","ตรวจสอบสถานะและรายละเอียดก่อนยืนยันการยกเลิก")+orderSummary(d.o);
  if(!CANCELLABLE.includes(d.o.status)){el.innerHTML+=card("ไม่สามารถยกเลิกได้","<p>ยกเลิกได้ก่อนเริ่มผลิตเท่านั้น หากพบปัญหากรุณาติดต่อร้าน</p>");return;}
  if(d.payments.some(p=>p.pay_type==="deposit"&&!p.verified)){el.innerHTML+=card("รอตรวจสอบการชำระเงิน","<p>ร้านต้องตรวจสอบหลักฐานมัดจำก่อนยกเลิก เพื่อคำนวณยอดคืนเงินให้ถูกต้อง</p>"+button("กลับไปคำสั่งซื้อ",orderUrl("order",d.o.order_id),"ghost"));return;}
  const dep=d.payments.filter(p=>p.pay_type==="deposit"&&p.verified).reduce((s,p)=>s+Number(p.amount),0);
  el.innerHTML+='<div class="grid cols-main"><form id="cancel-form" class="card" novalidate><h2>เหตุผลการยกเลิก</h2>'+field("category","เลือกเหตุผล",{options:[{value:"",label:"เลือกเหตุผล"},{value:"เปลี่ยนแผน",label:"เปลี่ยนแผนการใช้งาน"},{value:"ปรับงบประมาณ",label:"ปรับงบประมาณ"},{value:"ไม่ยอมรับราคา",label:"ไม่ยอมรับใบเสนอราคา"},{value:"อื่น ๆ",label:"อื่น ๆ"}]})+field("reason","รายละเอียดเพิ่มเติม",{type:"textarea",required:true})+
    checkbox("confirmed","รับทราบผลการยกเลิกและตรวจสอบคำสั่งซื้อแล้ว")+'<div data-banner hidden role="alert"></div><div class="actions">'+button("กลับไปคำสั่งซื้อ",orderUrl("order",d.o.order_id),"ghost")+'<button type="submit" class="btn danger">ยืนยันยกเลิก</button></div></form>'+
    card("ตรวจสอบก่อนยกเลิก",'<p><strong>'+esc(d.o.order_code)+'</strong></p><p>'+esc(d.o.machine_models?.name??d.o.machine_type)+'</p><div class="rule"></div><dl class="summary-dl"><dt>มัดจำที่ตรวจสอบแล้ว</dt><dd>'+money(dep)+'</dd></dl><div class="banner warning">'+(dep?"หลังยกเลิก กรุณากรอกบัญชีรับคืนมัดจำในหน้าคืนเงิน":"ยังไม่มีมัดจำที่ร้านตรวจสอบแล้ว")+'</div>')+'</div>';
  const form=$("#cancel-form"),validation=bindValidation(form,{category:v=>v?"":"กรุณาเลือกเหตุผล",reason:validators.note,confirmed:v=>v?"":"กรุณายืนยันการรับทราบ"});
  form.onsubmit=async e=>{e.preventDefault();if(!validation.validate())return;const v=validation.values();
    if(!await confirm("ยืนยันยกเลิก "+d.o.order_code+"?","ยกเลิกเฉพาะรายการนี้ หากมีมัดจำที่ตรวจสอบแล้วจะเข้าสู่ขั้นคืนเงิน",{label:"ยืนยันยกเลิก",danger:true}))return;
    await busy(form,async()=>{try{await cancelOrder(d.o.order_id,v.category+": "+v.reason);location.replace(orderUrl(dep?"refund":"order",d.o.order_id));}catch(error){banner(form,errorMessage(error));}});
  };
}

