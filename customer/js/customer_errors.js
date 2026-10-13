export class CustomerError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "CustomerError";
    Object.assign(this, options);
  }
}
const businessErrors = {
  CUSTOMER_INACTIVE: "บัญชีนี้ถูกระงับ กรุณาติดต่อร้านค้า",
  PROFILE_INCOMPLETE:
    "กรุณาแก้ไขชื่อและเบอร์โทรศัพท์ในหน้าข้อมูลส่วนตัวให้ครบก่อนสั่งซื้อ",
  PROFILE_REQUIRED: "กรุณาเข้าสู่ระบบอีกครั้ง",
  ORDER_NOT_FOUND: "ไม่พบคำสั่งซื้อนี้ หรือคุณไม่มีสิทธิ์เข้าถึง",
  QUOTE_EXPIRED: "ใบเสนอราคาหมดอายุแล้ว กรุณาติดต่อร้านเพื่อออกใบเสนอราคาใหม่",
  MODEL_NOT_FOUND: "ไม่พบรุ่นเครื่องที่ยังเปิดรับคำสั่งซื้อ กรุณาเลือกรุ่นใหม่",
  INVALID_PHONE: "กรุณากรอกเบอร์โทรศัพท์ไทย 9–10 หลัก",
  INVALID_NAME: "กรุณากรอกชื่อ 2–120 ตัวอักษร",
  INVALID_ADDRESS: "กรุณาระบุที่อยู่ติดตั้งให้ครบถ้วน",
  INVALID_NOTE: "กรุณาระบุรายละเอียด 5–1,000 ตัวอักษร",
  INVALID_ACCOUNT: "ข้อมูลบัญชีรับเงินคืนไม่ครบหรือไม่ถูกต้อง",
  INVALID_PROFILE: "ข้อมูลติดต่อไม่ครบหรือไม่ถูกต้อง กรุณาตรวจสอบช่องที่กรอก",
  INVALID_AMOUNT: "ยอดชำระเปลี่ยนแล้ว กรุณาโหลดข้อมูลคำสั่งซื้อใหม่",
  INVALID_PAYMENT_DATE: "วันที่หรือเวลาชำระไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
  WRONG_STATUS: "สถานะคำสั่งซื้อเปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่",
  PAYMENT_PENDING: "ส่งหลักฐานแล้ว กรุณารอร้านตรวจสอบ",
  PRODUCTION_STARTED: "เริ่มผลิตแล้ว จึงไม่สามารถยกเลิกได้",
  INVALID_SLIP: "กรุณาแนบไฟล์ JPG, PNG หรือ PDF ขนาดไม่เกิน 10 MB",
  ACCEPTANCE_REQUIRED: "กรุณายืนยันตรวจรับครบทุกข้อก่อนชำระยอดคงเหลือ",
  RESCHEDULE_TOO_LATE: "ใกล้ถึงวันนัดแล้ว กรุณาติดต่อร้านเพื่อประสานงาน",
  REQUEST_PENDING: "มีคำขอเลื่อนนัดที่รอดำเนินการอยู่แล้ว",
};
export function errorMessage(error) {
  if (error instanceof CustomerError) return error.message;
  const text = String(error?.message ?? "");
  for (const [code, message] of Object.entries(businessErrors))
    if (text.includes(code)) return message;
  if (error?.code === "23505")
    return /phone/i.test(text)
      ? "เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว"
      : /email/i.test(text)
        ? "อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่น"
        : "ข้อมูลนี้ถูกใช้งานแล้ว กรุณาตรวจสอบอีกครั้ง";
  if (error?.code === "23503")
    return "ข้อมูลอ้างอิงเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่";
  if (["23514", "23502", "22P02"].includes(error?.code))
    return "ข้อมูลไม่ครบหรือไม่ถูกต้อง กรุณาตรวจสอบช่องที่กรอก";
  if (error?.code === "42501" || error?.status === 403)
    return "คุณไม่มีสิทธิ์ทำรายการนี้ กรุณาเข้าสู่ระบบอีกครั้ง";
  if (
    ["user_already_exists", "email_exists"].includes(error?.code) ||
    /already registered|email.*already.*(?:registered|used|exists)/i.test(text)
  )
    return "อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบด้วยบัญชีเดิม";
  if (error?.status === 401 || /invalid login|invalid credentials/i.test(text))
    return "อีเมลหรือเบอร์โทรศัพท์และรหัสผ่านไม่ถูกต้อง";
  if (/email.*confirm/i.test(text)) return "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ";
  if (error?.status === 429 || /rate limit/i.test(text))
    return "ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
  // PostgREST returns HTTP 404 for a missing RPC; classify its code before generic 404.
  if (
    ["PGRST202", "PGRST204", "42883", "42703"].includes(error?.code) ||
    /non-2xx/i.test(text)
  )
    return "บริการนี้ยังไม่พร้อมใช้งาน กรุณาติดต่อร้านหรือทดลองใหม่ภายหลัง";
  if (error?.status === 404 || ["PGRST116"].includes(error?.code))
    return "ไม่พบข้อมูลที่ต้องการ";
  if (/database error saving new user/i.test(text))
    return "สร้างบัญชีไม่ได้ เบอร์โทรศัพท์อาจถูกใช้แล้ว หรือข้อมูลไม่ครบ กรุณาตรวจสอบและลองใหม่";
  if (error?.status >= 500) return "ระบบขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง";
  if (/fetch|network|offline|timeout/i.test(text))
    return "เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
  if (error?.status === 400)
    return "ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบช่องที่กรอกแล้วลองใหม่";
  return "ทำรายการไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่";
}

export function errorField(error) {
  const text = String(error?.message ?? "");
  if (
    ["user_already_exists", "email_exists"].includes(error?.code) ||
    /email.*(?:already|unique)|already registered/i.test(text)
  )
    return "email";
  if (
    (error?.code === "23505" && /phone/i.test(text)) ||
    text.includes("INVALID_PHONE")
  )
    return "phone";
  if (text.includes("INVALID_NAME")) return "name";
  if (text.includes("INVALID_ADDRESS")) return "install_address";
  if (text.includes("INVALID_NOTE") || text.includes("INVALID_REASON"))
    return "note";
  return null;
}
