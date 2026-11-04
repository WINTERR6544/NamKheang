// Plain-Thai error messages for every site (customer, shop, factory, sign-in page).
// The database raises short English messages or codes on purpose (docs/db/language.md); this file turns
// each one into wording a non-technical person understands. Classic script: sets globalThis.nkErrorTH.
// Customer modules load it with `import "../../shared/errors-th.js"`; staff pages with a <script> tag.
(() => {
  // exact database message -> Thai (codes and English sentences from `raise exception`)
  const EXACT = {
    // sign-in, permission, account
    "Not authorised": "บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้",
    NOT_SIGNED_IN: "หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง",
    PROFILE_REQUIRED: "กรุณาเข้าสู่ระบบอีกครั้ง",
    CUSTOMER_INACTIVE: "บัญชีนี้ถูกระงับ กรุณาติดต่อร้าน",
    PROFILE_INCOMPLETE: "กรุณากรอกชื่อและเบอร์โทรศัพท์ในหน้าข้อมูลส่วนตัวให้ครบก่อน",
    INVALID_PROFILE: "ข้อมูลติดต่อไม่ครบหรือไม่ถูกต้อง กรุณาตรวจสอบช่องที่กรอก",
    customer_unique_phone: "เบอร์โทรศัพท์นี้มีคนใช้แล้ว กรุณาใช้เบอร์อื่น",
    "User not found": "ไม่พบผู้ใช้นี้ อาจถูกลบไปแล้ว กรุณาโหลดหน้าใหม่",
    "Unknown role": "กรุณาเลือกบทบาทของผู้ใช้",
    "A factory user needs a factory": "กรุณาเลือกโรงงานที่สังกัด (ต้องเป็นโรงงานที่เปิดใช้งาน)",
    "This email already has an account": "อีเมลนี้เป็นผู้ใช้ในระบบอยู่แล้ว",
    "You cannot demote or deactivate your own account": "ไม่สามารถลดสิทธิ์หรือปิดใช้งานบัญชีของตัวเองได้",
    "Please enter a name and an email": "กรุณาเลือกบัญชีและกรอกชื่อให้ครบ",
    "Please enter a name": "กรุณากรอกชื่อ",
    "Please enter the customer's account": "กรุณาระบุบัญชีของลูกค้า",
    "This customer still has orders in progress": "ลูกค้ารายนี้ยังมีคำสั่งซื้อที่กำลังดำเนินการ ต้องให้เสร็จหรือยกเลิกก่อนจึงเปลี่ยนบทบาทได้",

    // input checks
    INVALID_NAME: "กรุณากรอกชื่อ 2–120 ตัวอักษร",
    INVALID_PHONE: "กรุณากรอกเบอร์โทรศัพท์ 9–10 หลัก",
    INVALID_ADDRESS: "กรุณากรอกที่อยู่ติดตั้งให้ครบ",
    INVALID_QUANTITY: "กรุณาเลือกจำนวนเครื่อง 1–20 เครื่อง",
    INVALID_NOTE: "กรุณาเขียนรายละเอียด 5–1,000 ตัวอักษร",
    INVALID_ACCOUNT: "ข้อมูลบัญชีรับเงินคืนไม่ครบหรือไม่ถูกต้อง",
    INVALID_AMOUNT: "ยอดเงินมีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่",
    INVALID_PAYMENT_DATE: "วันที่หรือเวลาที่โอนไม่ถูกต้อง",
    INVALID_SLIP: "กรุณาแนบรูปสลิปเป็นไฟล์ JPG, PNG หรือ PDF ขนาดไม่เกิน 10 MB",
    "A field is too long": "ข้อความบางช่องยาวเกินไป กรุณาย่อให้สั้นลง",
    "The note is too long (1000 characters at most)": "ข้อความยาวเกินไป (ไม่เกิน 1,000 ตัวอักษร)",
    "The reason is too long (1000 characters at most)": "เหตุผลยาวเกินไป (ไม่เกิน 1,000 ตัวอักษร)",
    "The reason is too long (500 characters at most)": "เหตุผลยาวเกินไป (ไม่เกิน 500 ตัวอักษร)",
    "Please enter a reason": "กรุณาเขียนเหตุผล",
    "Please give the reason for declining": "กรุณาเขียนเหตุผลที่ปฏิเสธ",
    "Please give the reason for moving the install date": "กรุณาเขียนเหตุผลที่ขอเลื่อนวันติดตั้ง",
    "Please give the reason it was rejected": "กรุณาเขียนเหตุผลที่ไม่อนุมัติ",
    "Please give the reason the factory declined": "กรุณาเขียนเหตุผลที่โรงงานปฏิเสธ",
    "Please describe the problem": "กรุณาเล่าปัญหาที่พบ",
    "Please check every item": "กรุณาติ๊กให้ครบทุกข้อ",
    "Choose the items to fix or write what needs fixing": "กรุณาเลือกข้อที่ต้องแก้ หรือเขียนสิ่งที่ต้องแก้ไข",
    "Please enter the items and prices": "กรุณากรอกรายการและราคาให้ครบ",
    "Please enter the estimated finish date": "กรุณาเลือกวันที่คาดว่าจะผลิตเสร็จ",
    "Please choose a date in the future": "กรุณาเลือกวันที่ยังมาไม่ถึง",
    "Please choose a new date in the future": "กรุณาเลือกวันใหม่ที่ยังมาไม่ถึง",
    "The new date is the same as the current one": "วันใหม่ตรงกับวันเดิม กรุณาเลือกวันอื่น",
    "Please enter your bank account": "กรุณากรอกเลขบัญชีธนาคาร",
    "Please enter the bank and the account name": "กรุณากรอกชื่อธนาคารและชื่อบัญชี",
    "The account number must be 8–20 digits": "เลขบัญชีต้องเป็นตัวเลข 8–20 หลัก",
    "PromptPay must be a 10-digit phone or 13-digit ID": "พร้อมเพย์ต้องเป็นเบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก",
    "The QR image must be an https link": "ลิงก์รูป QR ไม่ถูกต้อง กรุณาอัปโหลดรูปใหม่",
    "Please attach the refund transfer slip": "กรุณาแนบสลิปการโอนเงินคืน",

    // orders, quotations, payments
    ORDER_NOT_FOUND: "ไม่พบคำสั่งซื้อนี้",
    "Order not found": "ไม่พบคำสั่งซื้อนี้",
    MODEL_NOT_FOUND: "รุ่นเครื่องนี้ไม่เปิดขายแล้ว กรุณาเลือกรุ่นอื่น",
    WRONG_STATUS: "คำสั่งซื้อนี้ถูกอัปเดตไปแล้ว กรุณาโหลดหน้าใหม่",
    "Quotation not found": "ไม่พบใบเสนอราคานี้",
    QUOTE_EXPIRED: "ใบเสนอราคาหมดอายุแล้ว กรุณาติดต่อร้านเพื่อขอใบใหม่",
    "The quotation has expired": "ใบเสนอราคาหมดอายุแล้ว กรุณาติดต่อร้านเพื่อขอใบใหม่",
    "A quotation can only be issued for a new order": "ออกใบเสนอราคาได้เฉพาะคำสั่งซื้อใหม่เท่านั้น",
    "This order is not waiting for quote confirmation": "คำสั่งซื้อนี้ไม่ได้รอยืนยันใบเสนอราคาแล้ว กรุณาโหลดหน้าใหม่",
    "The order is not waiting for a deposit": "คำสั่งซื้อนี้ไม่ได้อยู่ในขั้นชำระมัดจำแล้ว",
    "The order has not reached the final payment step": "ยังไม่ถึงขั้นชำระยอดคงเหลือ",
    PAYMENT_PENDING: "ส่งสลิปแล้ว กรุณารอร้านตรวจสอบ",
    "Deposit slip already sent, waiting for the shop to verify it": "ส่งสลิปมัดจำแล้ว กรุณารอร้านตรวจสอบ",
    "Payment slip already sent, waiting for the shop to verify it": "ส่งสลิปแล้ว กรุณารอร้านตรวจสอบ",
    "Payment not found": "ไม่พบรายการชำระเงินนี้",
    "Already verified": "รายการนี้ตรวจสอบไปแล้ว",
    PRODUCTION_STARTED: "โรงงานเริ่มผลิตแล้ว จึงยกเลิกไม่ได้ กรุณาติดต่อร้าน",
    "Cannot cancel: production has started": "โรงงานเริ่มผลิตแล้ว จึงยกเลิกไม่ได้",
    "Cannot cancel: production has started. Please contact the shop": "โรงงานเริ่มผลิตแล้ว จึงยกเลิกไม่ได้ กรุณาติดต่อร้าน",
    "No pending refund found": "ไม่มีรายการคืนเงินที่รอดำเนินการ",
    "There is no pending refund for this order": "คำสั่งซื้อนี้ไม่มีรายการคืนเงินที่รอดำเนินการ",
    "Refunds use staff_confirm_refund": "รายการคืนเงินให้ยืนยันที่หน้า \"คืนเงิน\"",
    "There is no pending request to withdraw": "ไม่มีคำขอที่รออยู่ให้ยกเลิก",

    // factory, production
    "No active factory found": "ยังไม่มีโรงงานที่เปิดใช้งาน กรุณาเพิ่มโรงงานก่อน",
    "Only orders with a paid deposit can be sent to a factory": "ส่งให้โรงงานได้เมื่อลูกค้าชำระมัดจำแล้วเท่านั้น",
    "The order is not waiting for a factory reply": "คำสั่งซื้อนี้ไม่ได้รอโรงงานตอบรับแล้ว",
    "This order is no longer waiting for a factory reply": "คำสั่งซื้อนี้ไม่ได้รอโรงงานตอบรับแล้ว กรุณาโหลดหน้าใหม่",
    "Still waiting for the factory to reply": "ยังรอโรงงานตอบรับอยู่",
    "The factory has already accepted": "โรงงานรับงานนี้ไปแล้ว",
    "There is no production order waiting for your reply": "ไม่มีคำขอผลิตที่รอคุณตอบ",
    "There is no request waiting for your reply": "ไม่มีคำขอที่รอคุณตอบ",
    "Production can start once the factory has accepted": "เริ่มผลิตได้หลังจากโรงงานรับงานแล้ว",
    "The order is not in production": "คำสั่งซื้อนี้ไม่ได้อยู่ระหว่างผลิต",
    "This order is not assigned to your factory": "คำสั่งซื้อนี้ไม่ใช่งานของโรงงานคุณ",
    "Only the factory can confirm the install": "เฉพาะโรงงานเท่านั้นที่ยืนยันการติดตั้งได้",
    "Only the factory can record QC": "เฉพาะโรงงานเท่านั้นที่บันทึกผล QC ได้",
    "Only the factory can reply to a production order": "เฉพาะโรงงานเท่านั้นที่ตอบรับคำขอผลิตได้",
    "Only the factory can send an order back for QC": "เฉพาะโรงงานเท่านั้นที่ส่งงานกลับไปตรวจ QC ได้",
    "Only the factory can update production": "เฉพาะโรงงานเท่านั้นที่อัปเดตการผลิตได้",

    // QC
    "Invalid QC stage": "ขั้นตอน QC ไม่ถูกต้อง กรุณาโหลดหน้าใหม่",
    "Invalid stage": "ขั้นตอนไม่ถูกต้อง กรุณาโหลดหน้าใหม่",
    "The order is not waiting for QC": "คำสั่งซื้อนี้ไม่ได้รอตรวจ QC แล้ว",
    "The order is not waiting for a QC review": "คำสั่งซื้อนี้ไม่ได้รอร้านตรวจผล QC แล้ว",
    "The order is not in the QC fix step": "คำสั่งซื้อนี้ไม่ได้อยู่ในขั้นแก้ไขหลังไม่ผ่าน QC",
    "The factory has not recorded the QC yet": "โรงงานยังไม่ได้บันทึกผล QC",
    "Some QC items failed. Send it back to the factory to fix": "มีบางข้อไม่ผ่าน QC กรุณาส่งกลับให้โรงงานแก้ไข",

    // installation
    "An install date can only be set after QC has passed": "นัดวันติดตั้งได้หลังจากผ่าน QC แล้ว",
    "The order is not in the install-scheduled step": "คำสั่งซื้อนี้ยังไม่ได้นัดวันติดตั้ง",
    "There is no install date yet": "ยังไม่ได้นัดวันติดตั้ง",
    "This install date is already confirmed": "วันติดตั้งนี้ยืนยันไปแล้ว",
    "Only a booked install can be confirmed": "ยืนยันได้เฉพาะงานที่นัดวันติดตั้งแล้ว",
    "Only a booked install can be moved": "เลื่อนได้เฉพาะงานที่นัดวันติดตั้งแล้ว",
    "A request to move this install is already waiting for the shop": "มีคำขอเลื่อนนัดรอร้านพิจารณาอยู่แล้ว",
    "A request to move this install is waiting for the shop": "มีคำขอเลื่อนนัดรอร้านพิจารณาอยู่ กรุณาจัดการคำขอนั้นก่อน",
    REQUEST_PENDING: "มีคำขอเลื่อนนัดรอร้านพิจารณาอยู่แล้ว",
    RESCHEDULE_TOO_LATE: "ใกล้ถึงวันนัดแล้ว เลื่อนเองไม่ได้ กรุณาติดต่อร้าน",
    "On-site QC is recorded while the install is scheduled": "บันทึก QC หน้างานได้เฉพาะงานที่นัดวันติดตั้งแล้ว",
    "Record the on-site QC before confirming the install": "กรุณาบันทึกผล QC หน้างานก่อนยืนยันการติดตั้ง",
    "The on-site QC failed. Fix it and record a new on-site QC": "QC หน้างานไม่ผ่าน กรุณาแก้ไขแล้วบันทึกผลใหม่",

    // acceptance
    ACCEPTANCE_REQUIRED: "กรุณาตรวจรับและติ๊กให้ครบทุกข้อก่อนชำระยอดคงเหลือ",
    "This order has not reached the acceptance step yet": "ยังไม่ถึงขั้นตรวจรับเครื่อง",
    "The customer has not reported a problem": "ลูกค้ายังไม่ได้แจ้งปัญหา",
    "There is no customer problem to forward": "ไม่มีปัญหาจากลูกค้าที่ต้องส่งต่อ",
  };

  // messages with a number or status inside (the database fills in the %)
  const PATTERNS = [
    [/^QC round (\d+) has already been reviewed/, (m) => `ผล QC รอบที่ ${m[1]} ตรวจไปแล้ว`],
    [/^QC round (\d+) is waiting for the shop/, (m) => `ผล QC รอบที่ ${m[1]} รอร้านตรวจอยู่`],
    [/^The current install date is less than (\d+) day/, (m) => `ต้องขอเลื่อนล่วงหน้าอย่างน้อย ${m[1]} วันก่อนวันนัด`],
    [/^The factory still has time to reply \((\d+) days?\)/, (m) => `โรงงานยังมีเวลาตอบรับอีก ${m[1]} วัน กรุณารอก่อน`],
    [/^status change .* is not allowed/i, () => "คำสั่งซื้อนี้ทำขั้นตอนนี้ไม่ได้แล้ว กรุณาโหลดหน้าใหม่"],
    [/^This order has no next step/, () => "คำสั่งซื้อนี้ไม่มีขั้นตอนถัดไปแล้ว"],
  ];

  // anything the lists above do not cover: classify by error type, never show the raw text
  function generic(e, text) {
    const code = e?.code, status = e?.status;
    if (/fetch|network|offline|timeout|load failed/i.test(text)) return "เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาตรวจสอบแล้วลองใหม่";
    if (status === 429 || /rate limit|too many/i.test(text)) return "ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
    if (/banned/i.test(text)) return "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อร้าน";
    if (/invalid login|invalid credentials/i.test(text)) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    if (/not confirmed/i.test(text)) return "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ";
    if (/already registered|user_already_exists|email_exists/i.test(text + code)) return "อีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบ";
    if (/jwt|session|refresh token/i.test(text) || status === 401) return "หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง";
    if (code === "42501" || status === 403 || /permission denied|row-level security/i.test(text)) return "บัญชีของคุณไม่มีสิทธิ์ทำรายการนี้";
    if (code === "23505") return /phone/i.test(text) ? "เบอร์โทรศัพท์นี้มีคนใช้แล้ว" : /email/i.test(text) ? "อีเมลนี้มีคนใช้แล้ว" : "ข้อมูลนี้มีอยู่ในระบบแล้ว";
    if (code === "23503") return "ข้อมูลนี้ถูกใช้งานอยู่หรือถูกลบไปแล้ว กรุณาโหลดหน้าใหม่";
    if (["23514", "23502", "22P02", "22001", "22007", "22008"].includes(code)) return "ข้อมูลบางช่องไม่ครบหรือไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
    if (/payload too large|exceeded the maximum allowed size|too large/i.test(text) || status === 413) return "ไฟล์ใหญ่เกินไป กรุณาเลือกไฟล์ที่เล็กกว่านี้";
    if (/mime|file type|invalid_mime/i.test(text)) return "ไฟล์ชนิดนี้ใช้ไม่ได้ กรุณาเลือกรูปภาพหรือ PDF";
    if (["PGRST202", "PGRST204", "42883", "42703", "42P01"].includes(code)) return "ระบบส่วนนี้ยังไม่พร้อมใช้งาน กรุณาแจ้งผู้ดูแลระบบ";
    if (code === "PGRST116" || status === 404) return "ไม่พบข้อมูลที่ต้องการ อาจถูกลบหรือเปลี่ยนไปแล้ว";
    if (status >= 500) return "ระบบขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง";
    return null;
  }

  const hasThai = (s) => /[฀-๿]/.test(s);

  // nkErrorTH(error, fallback) -> plain Thai text
  // known(error) -> Thai for a message the database raises on purpose, else null
  const known = (e) => {
    const text = String(e?.message ?? e ?? "").trim(), bare = text.replace(/\.$/, "");
    if (EXACT[bare]) return EXACT[bare];
    for (const [k, v] of Object.entries(EXACT)) if (/^[A-Za-z_]+$/.test(k) && k.includes("_") && text.includes(k)) return v;
    for (const [re, f] of PATTERNS) { const m = bare.match(re); if (m) return f(m); }
    return null;
  };

  globalThis.nkErrorTH = (e, fallback = "ทำรายการไม่สำเร็จ กรุณาลองใหม่") => {
    const text = String(e?.message ?? e ?? "").trim();
    if (!text && !e?.code && !e?.status) return fallback;
    if (hasThai(text)) return text; // already written in Thai by the page
    return known(e) ?? generic(e, text) ?? fallback;
  };
  globalThis.nkErrorTH.known = known;
})();
