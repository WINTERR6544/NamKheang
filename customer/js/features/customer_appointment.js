import {$,heading,card,button,orderSummary,field,modal,toast,banner} from "../components/customer_ui.js";
import {bindValidation,validators} from "../components/customer_validation.js";
import {getOrder,getRules,requestReschedule} from "../services/customer_order_service.js";
import {esc,date,orderUrl} from "../customer_format.js";
import {CustomerError} from "../customer_errors.js";
export async function render(context,el){
  const d=await getOrder(context.orderId,context.profile.customer_id),a=d.appointments.filter(a=>a.status==="scheduled").at(-1),lastAcceptance=d.acceptance.at(-1);
  const rules=await getRules();
  el.innerHTML=heading("นัดหมายติดตั้ง","ตรวจสอบกำหนดการและเตรียมสถานที่ให้พร้อมก่อนทีมช่างเข้าติดตั้ง")+orderSummary(d.o)+
    '<div class="grid cols-main">'+card(a?"นัดหมายที่ยืนยันแล้ว":lastAcceptance?.passed===false?"รอประสานวันเข้าดำเนินการใหม่":"รอกำหนดวันติดตั้ง",
    (a?'<div class="appointment-date">'+date(a.install_datetime,true)+'</div>':'<div class="banner warning">ยังไม่มีนัดหมายใหม่ที่ยืนยัน กรุณารอร้านประสานงาน</div>')+
    (lastAcceptance?.passed===false?'<p>ปัญหาที่แจ้ง: '+esc(lastAcceptance.note)+'</p>':"")+
    '<div class="rule"></div><dl class="summary-dl"><dt>สถานที่ติดตั้ง</dt><dd>'+esc(d.o.install_address)+'</dd><dt>ระบบไฟฟ้า</dt><dd>'+esc(d.o.install_power||"ยังไม่ระบุ")+'</dd><dt>พื้นที่</dt><dd>'+esc(d.o.install_space||"ยังไม่ระบุ")+'</dd></dl>'+
    (a&&d.o.status===8?'<div class="actions"><button class="btn ghost" id="reschedule">ขอเลื่อนนัด</button></div><small>แจ้งล่วงหน้าอย่างน้อย '+(rules.reschedule_notice_days??1)+' วัน วันนัดเดิมยังคงอยู่จนกว่าร้านยืนยันใหม่</small>':""))+
    card("เตรียมพร้อมก่อนวันติดตั้ง",'<ul><li>จุดน้ำดีและท่อน้ำทิ้งตามแบบที่ตกลง</li><li>ระบบไฟฟ้า เบรกเกอร์ และสายดินที่เหมาะกับรุ่นเครื่อง</li><li>พื้นที่ติดตั้งและทางเข้าให้ทีมช่างเข้าถึงได้</li><li>ผู้ประสานงานอยู่รับทีมช่างและร่วมทดสอบ</li></ul>')+'</div>'+
    card("ประวัตินัดหมาย",d.appointments.length?'<ul class="activity">'+d.appointments.map(ap=>'<li>'+date(ap.install_datetime,true)+' · '+esc({scheduled:"ยืนยันนัด",rescheduled:"เลื่อนแล้ว",completed:"ติดตั้งแล้ว",cancelled:"ยกเลิก"}[ap.status])+(ap.reschedule_reason?'<small>'+esc(ap.reschedule_reason)+'</small>':"")+'</li>').join("")+'</ul>':'<p class="muted">ยังไม่มีประวัตินัดหมาย</p>');
  if($("#reschedule"))$("#reschedule").onclick=()=>modal("ขอเลื่อนวันติดตั้ง",'<form id="reschedule-form" novalidate>'+field("preferred","วันและเวลาที่สะดวก",{type:"datetime-local",required:true})+field("reason","เหตุผลการเลื่อน",{type:"textarea",required:true})+'</form>',{saveLabel:"ส่งคำขอ",onOpen:dialog=>{
    dialog.validation=bindValidation($("#reschedule-form",dialog),{preferred:v=>v&&new Date(v+":00+07:00")>new Date()?"":"กรุณาเลือกวันและเวลาในอนาคต",reason:validators.note});
  },onSave:async dialog=>{
    if(!dialog.validation.validate())throw new CustomerError("กรุณาตรวจสอบข้อมูลที่กรอก");
    const v=dialog.validation.values();await requestReschedule(d.o.order_id,new Date(v.preferred+":00+07:00").toISOString(),v.reason);toast("ส่งคำขอเลื่อนนัดแล้ว วันนัดเดิมยังคงอยู่");context.reload();
  }});
}

