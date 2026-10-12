export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const money = value => new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",minimumFractionDigits:2}).format(Number(value ?? 0));
export const date = (value, time=false) => value ? new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"medium",...(time?{timeStyle:"short"}:{})}).format(new Date(value)) : "ยังไม่กำหนด";
export const todayBangkok = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export const orderUrl = (page,id) => page + ".html?id=" + encodeURIComponent(id);
export const normalizePhone = value => {
  let s = String(value ?? "").replace(/[\s()-]/g,"");
  if(s.startsWith("+66")) s="0"+s.slice(3);
  return s;
};
export const validId = value => /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value));
export const balance = (quote,payments) => Math.max(0,Number(quote?.total_price ?? 0)-payments.filter(p=>p.pay_type==="deposit"&&p.verified).reduce((sum,p)=>sum+Number(p.amount),0));
export const initials = name => String(name || "ล").split(/\s+/).slice(0,2).map(s=>s[0]).join("");

