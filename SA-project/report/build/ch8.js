const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, HeadingLevel, PageOrientation,
  Table, TableRow, TableCell, WidthType, TableLayoutType, VerticalMergeType, VerticalAlign, BorderStyle } = require('docx');

const D = __dirname + '/../screenshots/';
const F = 'TH Sarabun New';
const r = (t, o = {}) => new TextRun({ text: t, font: F, size: 32, ...o });
const png = (f) => { const b = fs.readFileSync(D + f + '.png'); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), b }; };

// 8.3: [UC ID, UC name, [[screenshot, [steps...]], ...]]  steps are numbered on through the UC
const T = [
  ['1', 'สมัครสมาชิก / เข้าสู่ระบบ', [
    ['UC01_2_sign_up', ['เปิดหน้าสมัครสมาชิก กรอกชื่อ เบอร์โทรศัพท์ อีเมล และรหัสผ่าน', 'กดปุ่ม "สมัครสมาชิก"']],
    ['UC01_1_login', ['กรอกอีเมลหรือเบอร์โทรศัพท์ และรหัสผ่าน', 'กดปุ่ม "เข้าสู่ระบบ"']],
    ['UC01_4_customer_dashboard', ['ระบบพาไปหน้าหลักของลูกค้า แสดงสรุปคำสั่งซื้อและการแจ้งเตือน']],
    ['UC01_3_forgot_password', ['กรณีลืมรหัสผ่าน กด "ลืมรหัสผ่าน" กรอกอีเมล แล้วกด "ส่งลิงก์" ระบบส่งลิงก์ตั้งรหัสผ่านใหม่ทางอีเมล']],
    ['UC01_5_profile', ['เปิดเมนู "ข้อมูลส่วนตัว" เพื่อตรวจและแก้ไขข้อมูลติดต่อ']],
    ['UC01_6_profile_change_picture', ['กดปุ่ม "เปลี่ยนรูป" แล้วเลือกไฟล์รูป JPG หรือ PNG']],
    ['UC01_7_profile_picture_changed', ['ระบบแสดงรูปโปรไฟล์ใหม่ในการ์ดโปรไฟล์และมุมขวาบนของเมนู']],
  ]],
  ['2', 'สร้างคำสั่งซื้อ', [
    ['UC02_1_catalog', ['เปิดเมนู "แค็ตตาล็อก" แล้วเลือกรุ่นเครื่องทำน้ำแข็ง']],
    ['UC02_2_new_order', ['กรอกจำนวนเครื่อง ที่อยู่ติดตั้ง ระบบไฟฟ้า และพื้นที่ติดตั้ง', 'กดปุ่ม "สร้างคำสั่งซื้อ"']],
    ['UC02_3_confirm', ['ระบบแสดงหน้าต่างยืนยัน กดปุ่ม "ยืนยัน"']],
    ['UC02_4_order_created', ['ระบบสร้างเลขคำสั่งซื้อ และแสดงสถานะ "รอใบเสนอราคา"']],
  ]],
  ['3', 'ออกใบเสนอราคาและชำระมัดจำ', [
    ['UC03_1_admin_new_orders', ['ร้านเปิดเมนู "คำสั่งซื้อใหม่" แล้วเลือกคำสั่งซื้อ']],
    ['UC03_2_admin_order_detail', ['ร้านตรวจรายละเอียดลูกค้า รุ่นเครื่อง และสถานที่ติดตั้ง แล้วกด "ออกใบเสนอราคา"']],
    ['UC03_3_admin_issue_quote', ['กรอกรายการ ราคา VAT เปอร์เซ็นต์มัดจำ และอายุใบเสนอราคา', 'กดปุ่ม "ออกใบเสนอราคา"']],
    ['UC03_4_admin_quotations', ['ระบบบันทึกใบเสนอราคา และแสดงในเมนู "ใบเสนอราคา" สถานะรอลูกค้าตอบรับ']],
    ['UC03_5_customer_order_quoted', ['ลูกค้าเห็นสถานะ "รอยืนยันราคา / ชำระมัดจำ" ในหน้าคำสั่งซื้อ']],
    ['UC03_6_customer_quotation', ['ลูกค้าเปิดใบเสนอราคา ตรวจยอดรวมและยอดมัดจำ แล้วกด "ยอมรับใบเสนอราคา"']],
    ['UC03_7_accept_quote_confirm', ['ระบบแสดงหน้าต่างยืนยันยอด กดปุ่ม "ยืนยัน"']],
    ['UC03_8_deposit_form', ['เลือกช่องทางชำระ ระบุวันเวลาที่โอน และแนบสลิป', 'กดปุ่ม "ส่งหลักฐานการชำระ"']],
    ['UC03_9_deposit_confirm', ['ระบบแสดงหน้าต่างยืนยัน กดปุ่ม "ยืนยัน"']],
    ['UC03_10_deposit_sent', ['ระบบเปลี่ยนสถานะเป็น "รอตรวจสอบมัดจำ"']],
    ['UC03_11_admin_deposit_list', ['ร้านเปิดเมนู "มัดจำ" เห็นรายการที่รอตรวจ']],
    ['UC03_12_admin_view_slip', ['ร้านกด "ดูสลิป" ตรวจหลักฐาน แล้วกด "อนุมัติ" ระบบเปลี่ยนสถานะเป็น "ชำระมัดจำแล้ว"']],
  ]],
  ['4', 'ส่งคำสั่งผลิตให้โรงงาน', [
    ['UC04_1_admin_factory_requests', ['ร้านเปิดเมนู "คำขอผลิตถึงโรงงาน" เห็นคำสั่งซื้อที่ชำระมัดจำแล้ว']],
    ['UC04_2_admin_order_drawer', ['เปิดคำสั่งซื้อ แล้วกด "ส่งให้โรงงาน"']],
    ['UC04_3_admin_send_to_factory', ['เลือกโรงงาน แล้วกดปุ่ม "ส่งคำสั่งผลิต"']],
    ['UC04_4_admin_waiting_factory', ['ระบบย้ายคำสั่งซื้อไปที่รายการ "รอโรงงานตอบรับ" และแจ้งเตือนโรงงาน']],
    ['UC04_5_factory_dashboard', ['โรงงานเข้าสู่ระบบ เห็นงานใหม่ในแดชบอร์ด']],
    ['UC04_6_factory_requests', ['โรงงานเปิดเมนู "คำขอผลิต" แล้วเลือกคำขอ']],
    ['UC04_7_factory_evaluate_accept', ['โรงงานเลือก "รับผลิต" แล้วกดปุ่ม "ยืนยัน" ระบบแจ้งผลให้ร้าน']],
  ]],
  ['5', 'เลือกโรงงานใหม่', [
    ['UC05_1_admin_choose_new_factory', ['เมื่อโรงงานปฏิเสธ ร้านกด "เลือกโรงงานใหม่" เลือกโรงงานอื่น แล้วกด "ส่งคำสั่งผลิต"', 'หากไม่มีโรงงานที่รับได้ ร้านกด "ยกเลิกและคืนมัดจำ" แทน']],
  ]],
  ['6', 'เริ่มผลิตและแจ้งผลิตเสร็จ', [
    ['UC06_1_factory_production_list', ['โรงงานเปิดเมนู "การผลิต" เห็นงานที่รอเริ่มผลิต']],
    ['UC06_2_factory_start_production', ['กรอกวันที่คาดว่าจะผลิตเสร็จ แล้วกดปุ่ม "เริ่มผลิต"']],
    ['UC06_3_factory_in_production', ['เมื่อผลิตเสร็จ กดปุ่ม "ผลิตเสร็จสิ้น" ระบบส่งงานเข้าสู่ขั้นตรวจ QC']],
  ]],
  ['7', 'ตรวจ QC และแก้ไขตามผล QC', [
    ['UC07_1_factory_qc_list', ['โรงงานเปิดเมนู "QC / แก้ไข" แล้วเลือกงานที่รอตรวจ']],
    ['UC07_2_factory_qc_form', ['เลือกผลผ่านหรือไม่ผ่านในแต่ละหัวข้อ', 'กดปุ่ม "บันทึกผล QC"']],
    ['UC07_3_factory_qc_submitted', ['ระบบส่งผล QC ให้ร้านตรวจ สถานะเป็น "รอร้านตรวจผล QC"']],
    ['UC07_4_admin_review_qc', ['ร้านเปิดผล QC ตรวจแต่ละหัวข้อ แล้วกด "ผ่าน QC" (หรือ "ส่งกลับให้แก้ไข" ถ้ามีข้อไม่ผ่าน)']],
    ['UC07_5_admin_pass_qc', ['ระบบแสดงหน้าต่างยืนยัน กดปุ่ม "ยืนยัน" สถานะเปลี่ยนเป็น "ผ่าน QC · รอนัดติดตั้ง"']],
  ]],
  ['8', 'นัดวันติดตั้ง', [
    ['UC08_1_admin_schedule_install', ['ร้านเลือกวันและเวลาติดตั้ง แล้วกดปุ่ม "บันทึกนัด"']],
    ['UC08_2_admin_installation_list', ['ระบบบันทึกนัด และแสดงในเมนู "การติดตั้ง"']],
    ['UC08_3_customer_appointment', ['ลูกค้าเห็นวันนัดติดตั้งในหน้าคำสั่งซื้อ']],
    ['UC08_4_factory_installation_list', ['โรงงานเปิดเมนู "การติดตั้ง" เห็นนัดที่ร้านบันทึกไว้']],
    ['UC08_5_factory_confirm_appointment', ['โรงงานกด "ยืนยันนัด" หรือเลือก "ขอเลื่อนนัด"']],
    ['UC08_6_factory_request_reschedule', ['กรณีขอเลื่อนนัด กรอกวันเวลาใหม่และเหตุผล แล้วกด "ส่งคำขอ"']],
    ['UC08_7_admin_approve_reschedule', ['ร้านกด "นัดตามวันนี้" เพื่ออนุมัติ หรือ "เลือกวันอื่น" ระบบแจ้งลูกค้าและโรงงาน']],
  ]],
  ['9', 'ยืนยันติดตั้งเสร็จ (On-site QC)', [
    ['UC09_1_factory_onsite_qc', ['โรงงานทดสอบหน้างานครบทุกหัวข้อ', 'กดปุ่ม "ยืนยันติดตั้งเสร็จ"']],
    ['UC09_2_factory_install_done', ['ระบบเปลี่ยนสถานะเป็น "ติดตั้งเสร็จ · รอตรวจรับ" และแจ้งลูกค้า']],
  ]],
  ['10', 'ตรวจรับ ชำระยอดคงเหลือ ออกใบเสร็จ', [
    ['UC10_1_customer_order_installed', ['ลูกค้าเปิดคำสั่งซื้อที่สถานะ "รอตรวจรับ"']],
    ['UC10_2_customer_acceptance', ['ติ๊กรายการตรวจรับให้ครบ แล้วกดปุ่ม "ยืนยันตรวจรับ"']],
    ['UC10_3_acceptance_confirm', ['ระบบแสดงหน้าต่างยืนยัน กดปุ่ม "ยืนยัน"']],
    ['UC10_4_final_payment_form', ['แนบสลิปยอดคงเหลือ แล้วกดปุ่ม "ส่งหลักฐานการชำระ"']],
    ['UC10_5_final_payment_confirm', ['ระบบแสดงหน้าต่างยืนยัน กดปุ่ม "ยืนยัน"']],
    ['UC10_6_admin_final_payment_list', ['ร้านเปิดเมนู "ยอดคงเหลือ" ตรวจสลิป แล้วกด "อนุมัติ"']],
    ['UC10_7_admin_order_completed', ['ระบบออกใบเสร็จ และเปลี่ยนสถานะเป็น "เสร็จสมบูรณ์"']],
    ['UC10_8_customer_payments', ['ลูกค้าเปิดเมนู "การชำระเงิน" เห็นรายการที่ตรวจแล้ว']],
    ['UC10_9_customer_receipt', ['ลูกค้ากด "ดูใบเสร็จ" แล้วพิมพ์หรือบันทึกเป็น PDF']],
  ]],
  ['11', 'ยกเลิกคำสั่งซื้อ', [
    ['UC11_1_customer_cancel_form', ['ลูกค้าเปิดคำสั่งซื้อแล้วกด "ยกเลิกคำสั่งซื้อ"', 'เลือกเหตุผลและกรอกรายละเอียด']],
    ['UC11_2_customer_cancel_confirm', ['ระบบแสดงหน้าต่างยืนยัน กดปุ่ม "ยืนยันยกเลิก"']],
    ['UC11_3_customer_order_cancelled', ['ระบบเปลี่ยนสถานะเป็น "ยกเลิกแล้ว" และแสดงเหตุผล']],
    ['UC11_4_admin_cancelled', ['ร้านเห็นคำสั่งซื้อในเมนู "ยกเลิกแล้ว"']],
  ]],
  ['12', 'คืนมัดจำ', [
    ['UC12_1_admin_refund_list', ['ร้านเปิดเมนู "คืนเงิน" เห็นมัดจำที่ต้องคืน']],
    ['UC12_2_admin_refund_popup', ['แนบสลิปการโอนคืน แล้วกดปุ่ม "ยืนยันคืนเงิน" ระบบแจ้งลูกค้า']],
  ]],
  ['13', 'ติดตามสถานะคำสั่งซื้อ', [
    ['UC13_1_my_orders', ['ลูกค้าเปิดเมนู "คำสั่งซื้อของฉัน" เห็นสถานะทุกคำสั่งซื้อ']],
    ['UC13_2_notifications', ['ลูกค้าเปิดเมนู "แจ้งเตือน" เห็นการเปลี่ยนสถานะแต่ละครั้ง']],
    ['UC13_3_payments', ['ลูกค้าเปิดเมนู "การชำระเงิน" ตรวจหลักฐานและใบเสร็จ']],
    ['UC13_5_customer_orders_final', ['คำสั่งซื้อที่เสร็จสมบูรณ์และยกเลิกแล้วแสดงแยกสถานะ']],
    ['UC13_4_admin_all_orders', ['ร้านเปิดเมนู "คำสั่งซื้อทั้งหมด" ค้นหาและกรองตามสถานะ']],
  ]],
  ['14', 'จัดการข้อมูลโรงงาน', [
    ['UC14_1_admin_factories', ['ผู้ดูแลระบบเปิดเมนู "บัญชีและสิทธิ์" แล้วเลือกแท็บ "โรงงาน"', 'กดปุ่ม "เพิ่มโรงงาน" (หรือ "แก้ไข" ที่โรงงานเดิม)']],
    ['UC14_2_admin_add_factory', ['กรอกชื่อโรงงาน ผู้ติดต่อ เบอร์โทร และกำลังผลิตต่อเดือน', 'กดปุ่ม "เพิ่ม" ระบบบันทึกและแสดงในรายการโรงงาน']],
  ]],
  ['15', 'จัดการผู้ใช้และสิทธิ์', [
    ['UC15_1_admin_accounts', ['ผู้ดูแลระบบเปิดเมนู "บัญชีและสิทธิ์" แท็บ "บัญชีผู้ใช้"', 'ค้นหาด้วยชื่อ อีเมล หรือเบอร์โทร หรือกรองตามบทบาทและสถานะ แล้วกด "จัดการ"']],
    ['UC15_2_admin_change_role', ['เลือกบทบาทใหม่ (และโรงงานที่สังกัด กรณีบทบาทโรงงาน)', 'กดปุ่ม "บันทึก" ระบบเปลี่ยนบทบาทของบัญชี']],
    ['UC15_3_admin_deactivate', ['กรณีปิดใช้งาน เลือกสถานะ "ปิดใช้งาน" แล้วกด "บันทึก" บัญชีนั้นจะเข้าสู่ระบบไม่ได้']],
  ]],
];

// landscape A4, margins as the other chapters (left 1.5", others 1")
const PW = 16838, PH = 11906, ML = 2160, MR = 1440, MT = 1440, MB = 1440;
const CW = PW - ML - MR, C1 = 1150, C2 = 2300, C3 = CW - C1 - C2;
const IMGW = Math.min(600, Math.floor((C3 - 240) / 15) - 4), IMGH = 430;        // twips -> px (15 twips = 1 px)
const line = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const borders = { top: line, bottom: line, left: line, right: line };
const cp = (children, o = {}) => new TableCell({ borders, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children, ...o });
const para = (t, o = {}) => new Paragraph({ children: [r(t, o.run)], alignment: o.align ?? AlignmentType.LEFT, spacing: { after: 40 } });

function ucTable([id, name, shots]) {
  let k = 0;
  const head = new TableRow({ tableHeader: true, cantSplit: true, children: [
    cp([para('UC ID', { align: AlignmentType.CENTER })], { width: { size: C1, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER }),
    cp([para('UC Name', { align: AlignmentType.CENTER })], { width: { size: C2, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER }),
    cp([para('Capture Screen', { align: AlignmentType.CENTER })], { width: { size: C3, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER })] });
  const rows = shots.map(([file, steps], i) => {
    const { w, h, b } = png(file);
    let W = IMGW, H = Math.round(h * IMGW / w);
    if (H > IMGH) { H = IMGH; W = Math.round(w * IMGH / h); }
    const first = i === 0, merge = first ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE;
    return new TableRow({ cantSplit: true, children: [
      cp(first ? [para(id, { align: AlignmentType.CENTER })] : [para('')], { width: { size: C1, type: WidthType.DXA }, verticalMerge: merge }),
      cp(first ? [para(name)] : [para('')], { width: { size: C2, type: WidthType.DXA }, verticalMerge: merge }),
      cp([...steps.map((s) => para(`${++k}. ${s}`)),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 },
          children: [new ImageRun({ type: 'png', data: b, transformation: { width: W, height: H } })] })],
        { width: { size: C3, type: WidthType.DXA } })] });
  });
  return new Table({ layout: TableLayoutType.FIXED, width: { size: CW, type: WidthType.DXA }, columnWidths: [C1, C2, C3], rows: [head, ...rows] });
}

const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [r(t, { bold: true, size: 36 })] });
const P = (t) => new Paragraph({ alignment: AlignmentType.THAI_DISTRIBUTE, indent: { firstLine: 720 }, spacing: { after: 160 }, children: [r(t)] });
const dash = png('ADM_01_dashboard'); const DW = 554, DH = Math.round(dash.h * DW / dash.w);

// 8.2: Query | UC ID | SQL Command, from the Query Table in chapter 4 (q.json)
function sqlTable() {
  const Q = JSON.parse(fs.readFileSync(__dirname + '/q.json', 'utf8'));
  const W = 11906 - ML - MR, A = 1300, B = 950, C = W - A - B;
  const cell = (children, w, o = {}) => new TableCell({ borders, width: { size: w, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children, ...o });
  const p = (t, al = AlignmentType.LEFT, sz = 30) => new Paragraph({ alignment: al, spacing: { after: 0 }, children: [r(t, { size: sz })] });
  const head = new TableRow({ tableHeader: true, cantSplit: true, children: [
    cell([p('Query', AlignmentType.CENTER, 32)], A, { verticalAlign: VerticalAlign.CENTER }), cell([p('UC ID', AlignmentType.CENTER, 32)], B, { verticalAlign: VerticalAlign.CENTER }),
    cell([p('SQL Command', AlignmentType.CENTER, 32)], C, { verticalAlign: VerticalAlign.CENTER })] });
  const rows = Q.map(([q, uc, , sql]) => new TableRow({ cantSplit: true, children: [
    cell([p(q, AlignmentType.CENTER)], A), cell([p(uc, AlignmentType.CENTER)], B),
    cell(sql.map((l) => new Paragraph({ spacing: { after: 0 }, indent: { left: /^(FROM|WHERE|SET|VALUES|JOIN|ORDER|GROUP|AND)\b/.test(l) ? 0 : 0 }, children: [r(l, { size: 28 })] })), C)] }));
  return new Table({ layout: TableLayoutType.FIXED, width: { size: W, type: WidthType.DXA }, columnWidths: [A, B, C], rows: [head, ...rows] });
}

const portrait = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [r('บทที่ 8', { bold: true, size: 40 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [r('การทดสอบระบบ', { bold: true, size: 36 })] }),
  H1('8.1 Output Design (Report)'),
  P('รายงานภาพรวมของระบบอยู่ที่หน้าแดชบอร์ดของร้าน แสดงจำนวนคำสั่งซื้อในแต่ละขั้นตอน งานที่ร้านต้องดำเนินการ และสัดส่วนคำสั่งซื้อตามสถานะ ดังภาพที่ 8.1'),
  new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 200 },
    children: [new ImageRun({ type: 'png', data: dash.b, transformation: { width: DW, height: DH } })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [r('ภาพที่ 8.1 แสดงหน้าแดชบอร์ดสรุปภาพรวมคำสั่งซื้อของร้าน', { size: 28 })] }),
  H1('8.2 SQL Statement ใน Use Case Description'),
  P('คำสั่ง SQL ที่ระบบใช้ในแต่ละ Use Case อ้างอิงรหัส Query เดียวกับ Query Table ในบทที่ 4 แสดงดังตารางที่ 8.1'),
  sqlTable(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 }, children: [r('ตารางที่ 8.1 แสดง SQL Statement ใน Use Case Description', { size: 28 })] }),
];
const landscape = [H1('8.3 การทดสอบโปรแกรมทำงานตาม Use Case Description'),
  P('ทดสอบการทำงานของระบบตามลำดับขั้นตอนใน Use Case Description ทั้ง 15 Use Case บนเว็บไซต์จริง โดยใช้คำสั่งซื้อตัวอย่าง ORD-2569-0049 ตั้งแต่สร้างคำสั่งซื้อจนเสร็จสมบูรณ์ และ ORD-2569-0047 สำหรับกรณียกเลิกคำสั่งซื้อ')];
T.forEach((t, i) => { if (i) landscape.push(new Paragraph({ pageBreakBefore: true, children: [] })); landscape.push(ucTable(t)); });

const doc = new Document({
  styles: { default: { document: { run: { font: F, size: 32 } } },
    paragraphStyles: [{ id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { font: F, size: 36, bold: true }, paragraph: { spacing: { before: 240, after: 160 }, keepNext: true, outlineLevel: 0 } }] },
  sections: [
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: MT, bottom: MB, left: ML, right: MR } } }, children: portrait },
    { properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: MT, bottom: MB, left: ML, right: MR } } }, children: landscape },
  ],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(process.argv[2], buf); console.log('ok', T.reduce((a, t) => a + t[2].length, 0), 'shots'); });
