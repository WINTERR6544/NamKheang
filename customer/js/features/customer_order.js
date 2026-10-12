import {$,heading,card,button,badge,orderSummary,quotationTable,empty} from "../components/customer_ui.js";
import {getOrder} from "../services/customer_order_service.js";
import {timeline,progress,nextAction,paymentSummary,orderDetails} from "../components/customer_order_components.js";
import {esc,date,money,orderUrl} from "../customer_format.js";
import {CANCELLABLE} from "../customer_constants.js";
export async function render(context,el) {
  const d=await getOrder(context.orderId,context.profile.customer_id);
  context.order=d;
  el.innerHTML=heading("ติดตามคำสั่งซื้อ "+d.o.order_code,"ข้อมูลล่าสุดของคำสั่งซื้อ",'<div class="row">'+(d.quote?button("ดูใบเสนอราคา",orderUrl("quotation",d.o.order_id),"ghost"):"")+(CANCELLABLE.includes(d.o.status)?button("ยกเลิกคำสั่งซื้อ",orderUrl("cancel-order",d.o.order_id),"danger"):"")+'</div>')+orderSummary(d.o)+card("ความคืบหน้าคำสั่งซื้อ",progress(d)+'<div class="row between"><span>'+badge(d.o.status)+'</span><button class="text-btn" id="refresh-order">โหลดข้อมูลล่าสุด</button></div>')+'<div class="grid cols-main" style="margin-top:18px"><div class="stack">'+orderDetails(d)+timeline(d)+'</div><div class="stack">'+nextAction(d)+(d.quote?paymentSummary(d):"")+card("ข้อมูลการติดตั้ง",'<p>'+date(d.appointments.filter(a=>a.status==="scheduled").at(-1)?.install_datetime,true)+'</p><div class="actions">'+button("ดูนัดหมาย",orderUrl("appointment",d.o.order_id),"ghost")+'</div>')+card("การแจ้งเตือน",d.notifications.length?'<ul class="activity">'+d.notifications.slice(0,5).map(n=>'<li>'+esc(n.message)+'<small>'+date(n.created_at,true)+'</small></li>').join("")+'</ul>':empty("ยังไม่มีข้อมูล"))+'</div></div>';
  $("#refresh-order").onclick=context.reload;
}

