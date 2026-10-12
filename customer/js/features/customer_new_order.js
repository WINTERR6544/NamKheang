import {$,heading,card,field,button,confirm,busy,banner,toast,empty} from "../components/customer_ui.js";
import {bindValidation,validators} from "../components/customer_validation.js";
import {getCatalog,createOrder} from "../services/customer_order_service.js";
import {esc,money,orderUrl} from "../customer_format.js";
import {TYPE_LABELS} from "../customer_constants.js";
import {errorMessage} from "../customer_errors.js";
export async function render(context,el) {
  const models=await getCatalog();
  if(context.page==="catalog"){
    el.innerHTML=heading("แค็ตตาล็อกเครื่องทำน้ำแข็ง","ราคาประกอบการพิจารณา ใบเสนอราคาจากร้านเป็นราคายืนยัน")+ (models.length?'<div class="model-grid">'+models.map(m=>card(m.name,'<p>'+esc(TYPE_LABELS[m.machine_type]??m.machine_type)+' · '+esc(m.capacity)+'</p><p class="muted">'+esc(m.description)+'</p><div class="rule"></div><strong>'+money(m.price)+'</strong><small> ก่อน VAT</small><div class="actions">'+button("เลือกรุ่นนี้","new-order.html?model="+m.model_id)+'</div>')).join("")+'</div>':card("",empty("ยังไม่มีรุ่นเครื่อง","กรุณาติดต่อร้านเพื่อสอบถามข้อมูล")));
    return;
  }
  if(!models.length){el.innerHTML=card("",empty("ยังไม่มีรุ่นที่เปิดรับคำสั่งซื้อ","กรุณาติดต่อร้าน"));return;}
  const key="iceflow.customer.draft."+context.profile.auth_id;
  let draft={};try{draft=JSON.parse(localStorage.getItem(key)||"{}");}catch{}
  const requested=new URLSearchParams(location.search).get("model");
  const initial=models.find(m=>String(m.model_id)===String(requested||draft.model_id))||models[0];
  el.innerHTML=heading("สร้างคำสั่งซื้อ","ระบุความต้องการและสถานที่ติดตั้ง ร้านจะตรวจสอบและส่งใบเสนอราคา")+
    '<div class="grid cols-form"><form id="order-form" class="stack" novalidate>'+card("",
      '<div class="section-title"><span>1</span><div><h2>ข้อมูลลูกค้า</h2><small>ข้อมูลผู้ติดต่อสำหรับคำสั่งซื้อนี้</small></div></div><div class="grid cols2">'+field("customer_name","ชื่อ–นามสกุล",{value:context.profile.name,readonly:true})+field("customer_phone","เบอร์โทรศัพท์",{value:context.profile.phone,readonly:true})+'</div>'+button("แก้ไขข้อมูลลูกค้า","profile.html","ghost sm"))+
    card("",'<div class="section-title"><span>2</span><div><h2>เลือกประเภทและรุ่นเครื่อง</h2><small>หนึ่งเครื่องต่อคำสั่งซื้อ</small></div></div><div class="model-grid">'+models.map(m=>'<label class="model-choice"><input type="radio" name="model_id" value="'+m.model_id+'" '+(m.model_id===initial.model_id?"checked":"")+'><strong>'+esc(m.name)+'</strong><small>'+esc(m.capacity)+'</small><small>'+esc(TYPE_LABELS[m.machine_type]??m.machine_type)+'</small></label>').join("")+'</div><p class="field-error" data-error="model_id" hidden></p>')+
    card("",'<div class="section-title"><span>3</span><div><h2>สถานที่ติดตั้ง</h2><small>ระบุที่อยู่และรายละเอียดระบบไฟฟ้า / พื้นที่</small></div></div>'+field("install_address","ที่อยู่ติดตั้ง",{value:draft.install_address||context.profile.contact_address||"",type:"textarea",required:true,placeholder:"บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"})+'<div class="grid cols2">'+field("install_power","ระบบไฟฟ้า",{value:draft.install_power||"",placeholder:"เช่น 380V 3 เฟส",maxLength:200})+field("install_space","พื้นที่ติดตั้ง",{value:draft.install_space||"",placeholder:"เช่น 4 × 6 เมตร",maxLength:200})+'</div><div data-banner hidden role="alert"></div><div class="actions"><button type="button" class="btn ghost" id="clear-draft">ลบร่าง</button><button type="submit" class="btn">ยืนยันคำสั่งซื้อ</button></div>')+
    '</form><aside class="card" id="order-review"></aside></div>';
  const form=$("#order-form"),validation=bindValidation(form,{
    model_id:v=>models.some(m=>String(m.model_id)===v)?"":"กรุณาเลือกรุ่นเครื่อง",
    install_address:validators.address
  });
  function update(){
    const v=validation.values(),m=models.find(m=>String(m.model_id)===v.model_id);
    $("#order-review").innerHTML='<h2>ตรวจสอบคำสั่งซื้อ</h2><h3>'+esc(m?.name)+'</h3><div class="rule"></div><dl class="summary-dl"><dt>กำลังผลิต</dt><dd>'+esc(m?.capacity)+'</dd><dt>จำนวน</dt><dd>1 เครื่อง</dd><dt>ราคาอ้างอิง</dt><dd>'+money(m?.price)+'</dd></dl><div class="banner warning">ยอดชำระจะยืนยันตามใบเสนอราคาจากร้าน การส่งคำสั่งซื้อยังไม่ใช่การชำระเงิน</div><small id="draft-state"></small>';
    try{localStorage.setItem(key,JSON.stringify({model_id:v.model_id,install_address:v.install_address,install_power:v.install_power,install_space:v.install_space}));$("#draft-state").textContent="บันทึกร่างในอุปกรณ์นี้แล้ว";}catch{$("#draft-state").textContent="อุปกรณ์นี้ไม่สามารถบันทึกร่างได้";}
  }
  form.addEventListener("input",update);update();
  $("#clear-draft").onclick=async()=>{if(await confirm("ลบร่างคำสั่งซื้อ?","ลบข้อมูลที่ยังไม่ได้ส่งในอุปกรณ์นี้",{label:"ลบร่าง",danger:true})){localStorage.removeItem(key);form.reset();form.elements.install_address.value="";form.elements.install_power.value="";form.elements.install_space.value="";update();localStorage.removeItem(key);toast("ลบร่างแล้ว");}};
  form.onsubmit=async e=>{
    e.preventDefault();if(!validation.validate())return;
    const v=validation.values();if(!await confirm("ยืนยันสร้างคำสั่งซื้อ?","ร้านจะได้รับรุ่นเครื่องและที่อยู่ติดตั้งเพื่อตรวจสอบและเสนอราคา",{label:"ส่งคำสั่งซื้อ"}))return;
    await busy(form,async()=>{try{
      const id=await createOrder(v);localStorage.removeItem(key);location.replace(orderUrl("order",id));
    }catch(error){banner(form,errorMessage(error));}});
  };
}

