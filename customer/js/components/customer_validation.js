import {normalizePhone} from "../customer_format.js";
export const validators = {
  required: (value,label="ข้อมูล") => String(value??"").trim() ? "" : "กรุณากรอก"+label,
  name:value=>String(value??"").trim().length>=2&&String(value).trim().length<=120?"":"กรุณากรอกชื่อ 2–120 ตัวอักษร",
  phone:value=>/^0\d{8,9}$/.test(normalizePhone(value))?"":"กรุณากรอกเบอร์โทรศัพท์ไทย 9–10 หลัก",
  email:value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value??"").trim())&&String(value).length<=254?"":"รูปแบบอีเมลไม่ถูกต้อง",
  password:value=>String(value??"").length>=8?"":"รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
  address:value=>String(value??"").trim().length>=10&&String(value).trim().length<=1000?"":"กรุณาระบุที่อยู่ให้ครบถ้วน 10–1,000 ตัวอักษร",
  note:value=>String(value??"").trim().length>=5&&String(value).trim().length<=1000?"":"กรุณาระบุรายละเอียด 5–1,000 ตัวอักษร",
  account:value=>/^\d{8,20}$/.test(String(value??"").replace(/[-\s]/g,""))?"":"เลขบัญชีต้องเป็นตัวเลข 8–20 หลัก"
};
export function bindValidation(form,rules) {
  const fields=name=>Array.from(form.elements).filter(field=>field.name===name);
  const values=()=>Object.fromEntries(new FormData(form));
  function check(name) {
    const field=form.elements.namedItem(name);
    const message=rules[name](field?.type==="checkbox"?(field.checked?"yes":""):field?.value,values());
    const error=form.querySelector('[data-error="'+name+'"]');
    fields(name).forEach(input=>input.setAttribute("aria-invalid",String(Boolean(message))));
    if(error) {error.textContent=message;error.hidden=!message;}
    return !message;
  }
  for(const name of Object.keys(rules)) {
    fields(name).forEach(field=>["blur","input","change"].forEach(event=>field.addEventListener(event,()=>check(name))));
  }
  return {
    values,
    validate:()=>{const result=Object.keys(rules).map(check);if(result.some(ok=>!ok)){form.querySelector('[aria-invalid="true"]')?.focus();return false;}return true;},
    error:(name,message)=>{const f=form.elements.namedItem(name);fields(name).forEach(input=>input.setAttribute("aria-invalid","true"));const e=form.querySelector('[data-error="'+name+'"]');if(e){e.textContent=message;e.hidden=false;}fields(name)[0]?.focus();}
  };
}

