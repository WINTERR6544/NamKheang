import { balance, todayBangkok } from "./lib.js";

/** Never reuse a passed acceptance from an installation that was later repaired. */
export function currentAcceptance(order, checks = []) {
  const latest = [...checks].sort(
    (a, b) =>
      Date.parse(b.checked_at) - Date.parse(a.checked_at) ||
      Number(b.check_id) - Number(a.check_id),
  )[0];
  if (!latest?.passed) return null;
  const checked = Date.parse(latest.checked_at);
  const installed = order.installed_at ? Date.parse(order.installed_at) : 0;
  return Number.isFinite(checked) &&
    Number.isFinite(installed) &&
    checked >= installed
    ? latest
    : null;
}
export function quoteExpired(quote, today = todayBangkok()) {
  return (
    !quote ||
    quote.status === "expired" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(quote.valid_until || "") ||
    quote.valid_until < today
  );
}
export function paymentGate(detail, type, today = todayBangkok()) {
  if (!["deposit", "final"].includes(type))
    return { allowed: false, reason: "ประเภทการชำระไม่ถูกต้อง" };
  const submitted = detail.payments.find(
    (payment) => payment.pay_type === type,
  );
  if (submitted)
    return {
      allowed: false,
      submitted,
      reason: "ส่งหลักฐานแล้ว กรุณารอร้านตรวจสอบ",
    };
  if (detail.o.status !== (type === "deposit" ? 1 : 9))
    return {
      allowed: false,
      reason: "สถานะคำสั่งซื้อยังไม่พร้อมสำหรับการชำระขั้นนี้",
    };
  if (detail.quote?.status !== "accepted")
    return {
      allowed: false,
      reason: "กรุณายอมรับใบเสนอราคาล่าสุดก่อนชำระเงิน",
    };
  if (type === "deposit" && quoteExpired(detail.quote, today))
    return {
      allowed: false,
      reason: "ใบเสนอราคาหมดอายุแล้ว กรุณาติดต่อร้านเพื่อออกฉบับใหม่",
    };
  if (type === "final" && !currentAcceptance(detail.o, detail.acceptance))
    return {
      allowed: false,
      reason: "กรุณาตรวจรับหลังการติดตั้งครั้งล่าสุดก่อนชำระยอดคงเหลือ",
    };
  const amount =
    type === "deposit"
      ? Number(detail.quote.deposit_amount)
      : balance(detail.quote, detail.payments);
  if (!Number.isFinite(amount) || amount <= 0)
    return { allowed: false, reason: "ไม่พบยอดชำระที่ถูกต้อง กรุณาติดต่อร้าน" };
  return { allowed: true, amount };
}
export function rescheduleGate(
  order,
  appointment,
  requests = [],
  noticeDays = 1,
  now = Date.now(),
) {
  if (order.status !== 8 || !appointment || appointment.status !== "scheduled")
    return { allowed: false, reason: "รอร้านยืนยันนัดหมาย" };
  const pending = requests.find((request) => request.status === "pending");
  if (pending)
    return {
      allowed: false,
      pending,
      reason: "มีคำขอเลื่อนนัดที่รอร้านประสานงานอยู่แล้ว",
    };
  const scheduled = Date.parse(appointment.install_datetime);
  if (
    !Number.isFinite(scheduled) ||
    scheduled < now + Math.max(0, Number(noticeDays) || 0) * 86400000
  )
    return {
      allowed: false,
      reason: "ใกล้ถึงวันนัดแล้ว กรุณาติดต่อร้านเพื่อประสานงาน",
    };
  return { allowed: true };
}
