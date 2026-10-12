import {$,heading,card,empty,button,badge,toast} from "../components/customer_ui.js";
import {listPayments,signedSlip} from "../services/customer_payment_service.js";
import {esc,money,date,orderUrl} from "../customer_format.js";
import {PAYMENT_LABELS} from "../customer_constants.js";
import {errorMessage} from "../customer_errors.js";
export async function showSlip(path){
  // Open immediately to avoid popup blockers, then replace with a short-lived URL.
  const tab=window.open("about:blank","_blank");
  if(tab)tab.opener=null;
  try {const url=await signedSlip(path);if(tab)tab.location.replace(url);else location.assign(url);}
  catch(error){tab?.close();toast(errorMessage(error),"error");}
}
export async function render(context,el){
  const rows=await listPayments(context.profile.customer_id);
  el.innerHTML=heading("การชำระเงิน","ตรวจสอบหลักฐานการชำระ ใบเสร็จ และการคืนมัดจำ")+
    (rows.length?card("",'<div class="table-wrap"><table><thead><tr><th>คำสั่งซื้อ</th><th>ประเภท</th><th>จำนวนเงิน</th><th>สถานะ</th><th>วันที่</th><th>รายละเอียด</th></tr></thead><tbody>'+rows.map(p=>'<tr><td class="mono">'+esc(p.orders.order_code)+'</td><td>'+PAYMENT_LABELS[p.pay_type]+'</td><td>'+money(p.amount)+'</td><td><span class="badge '+(p.verified?"success":"warning")+'">'+(p.verified?(p.pay_type==="refund"?"คืนเงินแล้ว":"ตรวจสอบแล้ว"):"รอตรวจสอบ")+'</span></td><td>'+date(p.paid_at,true)+'</td><td>'+button(p.pay_type==="refund"?"บัญชีและคืนเงิน":"ดูคำสั่งซื้อ",orderUrl(p.pay_type==="refund"?"refund":"order",p.order_id),"ghost sm")+(p.verified&&p.receipt_no?" "+button("ใบเสร็จ",orderUrl("receipt",p.order_id),"ghost sm"):"")+(p.slip_path?' <button class="btn ghost sm" data-slip="'+esc(p.slip_path)+'">หลักฐาน</button>':"")+'</td></tr>').join("")+'</tbody></table></div>'):card("",empty("ยังไม่มีรายการชำระเงิน","รายการจะแสดงหลังส่งหลักฐานการชำระเงิน",button("ดูคำสั่งซื้อ","orders.html"))));
  el.querySelectorAll("[data-slip]").forEach(b=>b.onclick=()=>showSlip(b.dataset.slip));
}

