export const STATUS = Object.freeze({
  0: "รอใบเสนอราคา",
  1: "รอยืนยันราคา / ชำระมัดจำ",
  2: "ชำระมัดจำแล้ว",
  3: "รอโรงงานตอบรับ",
  4: "กำลังผลิต",
  5: "รอตรวจ QC",
  6: "แก้ไขตามผล QC",
  7: "ผ่าน QC",
  8: "นัดหมายติดตั้ง",
  9: "รอตรวจรับ / ชำระยอดคงเหลือ",
  10: "เสร็จสมบูรณ์",
  99: "ยกเลิกแล้ว",
});
export const MAIN_PATH = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10];
export const CANCELLABLE = [0, 1, 2, 3];
export const PAGE_SIZE = 10;
export const MAX_SLIP_BYTES = 10 * 1024 * 1024;
export const SLIP_TYPES = ["image/jpeg", "image/png", "application/pdf"];
export const TITLES = {
  receipt: "ใบเสร็จรับเงิน",
  dashboard: "หน้าหลัก",
  orders: "คำสั่งซื้อของฉัน",
  catalog: "แค็ตตาล็อกเครื่องทำน้ำแข็ง",
  "new-order": "สร้างคำสั่งซื้อ",
  order: "ติดตามคำสั่งซื้อ",
  quotation: "ใบเสนอราคา",
  deposit: "ชำระมัดจำ",
  appointment: "นัดหมายติดตั้ง",
  acceptance: "ตรวจรับเครื่องและการติดตั้ง",
  "final-payment": "ชำระยอดคงเหลือ",
  "cancel-order": "ยกเลิกคำสั่งซื้อ",
  refund: "คืนเงินและบัญชีรับเงินคืน",
  payments: "การชำระเงิน",
  notifications: "แจ้งเตือน",
  profile: "ข้อมูลส่วนตัวและการติดต่อ",
};
export const TYPE_LABELS = {
  "Tube ice machine": "เครื่องทำน้ำแข็งหลอด",
  "Flake ice machine": "เครื่องทำน้ำแข็งเกล็ด",
  "Block ice machine": "เครื่องทำน้ำแข็งก้อน",
};
export const PAYMENT_LABELS = {
  deposit: "มัดจำ",
  final: "ยอดคงเหลือ",
  refund: "คืนมัดจำ",
};
