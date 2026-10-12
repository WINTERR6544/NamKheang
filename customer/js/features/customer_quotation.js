import {$,heading,card,button,orderSummary,quotationTable,confirm,toast} from "../components/customer_ui.js";
import {getOrder,acceptQuote} from "../services/customer_order_service.js";
import {money,date,todayBangkok,orderUrl} from "../customer_format.js";
import {errorMessage} from "../customer_errors.js";
export async function render(context,el){
  const d=await getOrder(context.orderId,context.profile.customer_id),q=d.quote;
  el.innerHTML=heading("ใบเสนอราคา","ตรวจสอบรายการ ราคา และวันหมดอายุก่อนยืนยัน")+orderSummary(d.o);
  if(!q){el.innerHTML+=card("รอใบเสนอราคา","<p>ร้านกำลังตรวจสอบคำสั่งซื้อ กรุณากลับมาตรวจสอบภายหลัง</p>");return;}
  const expired=q.valid_until<todayBangkok();
  el.innerHTML+='<div class="grid cols-main">'+card("รายละเอียดใบเสนอราคา",quotationTable(q)+'<div class="actions"><button type="button" class="btn ghost" id="print">พิมพ์ / บันทึก PDF</button></div>')+card("สรุปยอด",'<dl class="summary-dl"><dt>มัดจำตามใบเสนอราคา</dt><dd>'+money(q.deposit_amount)+'</dd><dt>ใช้ได้ถึง</dt><dd>'+date(q.valid_until)+'</dd></dl>'+
    (expired?'<div class="banner warning">ใบเสนอราคาหมดอายุ กรุณาติดต่อร้านเพื่อออกฉบับใหม่</div>':"")+
    (d.o.status===1&&!expired?(q.status==="sent"?'<div class="actions"><button type="button" class="btn block" id="accept-quote">ยอมรับใบเสนอราคา</button></div>':button("ชำระมัดจำ",orderUrl("deposit",d.o.order_id),"block")):"")+
    ([0,1,2,3].includes(d.o.status)?'<div class="actions">'+button("ไม่ยอมรับราคา / ยกเลิก",orderUrl("cancel-order",d.o.order_id),"danger block")+'</div>':""))+'</div>';
  $("#print").onclick=()=>window.print();
  if($("#accept-quote"))$("#accept-quote").onclick=async()=>{
    if(!await confirm("ยอมรับใบเสนอราคา?","ยอดรวม "+money(q.total_price)+" และมัดจำ "+money(q.deposit_amount),{label:"ยอมรับราคา"}))return;
    const b=$("#accept-quote");b.disabled=true;
    try{await acceptQuote(d.o.order_id);location.href=orderUrl("deposit",d.o.order_id);}
    catch(error){toast(errorMessage(error),"error");b.disabled=false;}
  };
}

