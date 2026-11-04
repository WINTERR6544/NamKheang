const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } = require('docx');

const F = 'TH Sarabun New';
const r = (t, o = {}) => new TextRun({ text: t, font: F, size: 32, ...o });
const P = (children, o = {}) => new Paragraph({ children, ...o });

let fig = 0;
const sections = [
  ['6.1 Frontend Development', [
    ['HTML', 'ใช้สร้างโครงสร้างหน้าเว็บของทั้ง 3 ฝั่ง ได้แก่ เว็บลูกค้า เว็บร้าน (Admin) และเว็บโรงงาน โดยแยกโฟลเดอร์ตามผู้ใช้งาน'],
    ['CSS', 'ใช้จัดรูปแบบและความสวยงามของหน้าเว็บ รวมถึงไฟล์สไตล์กลางที่ใช้ร่วมกันทุกฝั่ง เพื่อให้หน้าตาระบบเป็นแนวเดียวกัน'],
    ['JavaScript', 'ใช้เขียนการทำงานฝั่งหน้าเว็บ เช่น การเข้าสู่ระบบ การสร้างคำสั่งซื้อ และการแสดงสถานะคำสั่งซื้อ โดยเชื่อมต่อฐานข้อมูลผ่านไลบรารี supabase-js ไม่ต้องติดตั้งหรือ build เพิ่มเติม'],
  ]],
  ['6.2 Backend Development', [
    ['Supabase', 'ใช้เป็น Backend ของระบบ ให้บริการฐานข้อมูล PostgreSQL ระบบยืนยันตัวตน (Auth) สำหรับลูกค้า ร้าน และโรงงาน พื้นที่เก็บไฟล์ (Storage) สำหรับสลิปการชำระเงิน และ Row Level Security เพื่อจำกัดให้ผู้ใช้เห็นเฉพาะข้อมูลของตนเอง'],
    ['PostgreSQL', 'ฐานข้อมูลหลักของระบบ ใช้เก็บข้อมูลลูกค้า คำสั่งซื้อ ใบเสนอราคา การชำระเงิน คำสั่งผลิต และผล QC รวมถึงใช้ Function และ Trigger ควบคุมการเปลี่ยนสถานะคำสั่งซื้อให้ถูกต้อง'],
    ['Deno (TypeScript)', 'ใช้เขียน Supabase Edge Functions สำหรับงานที่ต้องทำฝั่งเซิร์ฟเวอร์ เช่น การเข้าสู่ระบบด้วยเบอร์โทรศัพท์และรหัสผ่าน'],
  ]],
  ['6.3 User Interface Design and Development', [
    ['Figma', 'ใช้ออกแบบหน้าจอ (UI) ของระบบก่อนนำไปพัฒนาจริง และใช้วาด ER Diagram ของฐานข้อมูล'],
  ]],
  ['6.4 เพิ่มเติม', [
    ['Visual Studio Code', 'โปรแกรมหลักที่ใช้เขียนโค้ด ร่วมกับส่วนเสริม Live Server สำหรับเปิดดูหน้าเว็บระหว่างพัฒนา'],
    ['Git และ GitHub', 'ใช้จัดการเวอร์ชันของซอร์สโค้ด และเป็นที่เก็บโค้ดกลางของทีม โดยแยก branch ตามฟีเจอร์ก่อนรวมเข้า main'],
  ]],
];

const kids = [
  P([r('บทที่ 6', { bold: true, size: 40 })], { alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
  P([r('Software Development Platform', { bold: true, size: 36 })], { alignment: AlignmentType.CENTER, spacing: { after: 360 } }),
];

for (const [head, tools] of sections) {
  kids.push(P([r(head, { bold: true })], { spacing: { before: 240, after: 120 }, keepNext: true }));
  for (const [name, desc] of tools) {
    fig++;
    kids.push(P([r(name, { bold: true })], { alignment: AlignmentType.CENTER, spacing: { before: 240 }, keepNext: true }));
    kids.push(P([r(`[ใส่โลโก้ ${name}]`, { color: '999999', size: 28 })], {
      alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 120 },
      border: ['top', 'bottom', 'left', 'right'].reduce((a, k) => (a[k] = { style: BorderStyle.DASHED, size: 6, color: 'BBBBBB', space: 24 }, a), {}),
      indent: { left: 3000, right: 3000 },
    }));
    kids.push(P([r(`ภาพที่ 6.${fig} แสดงตราสัญลักษณ์ของ ${name}`, { size: 28 })], { alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 120 } }));
    kids.push(P([r(desc)], { alignment: AlignmentType.THAI_DISTRIBUTE, indent: { firstLine: 720 }, spacing: { after: 240 } }));
  }
}

const doc = new Document({
  styles: { default: { document: { run: { font: F, size: 32 } } } },
  sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 2160, right: 1440 } } }, children: kids }],
});
Packer.toBuffer(doc).then(b => fs.writeFileSync(process.argv[2], b));
