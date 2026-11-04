// Admin > Payment details: the shop's bank account, PromptPay and QR that customers see when they pay
// the deposit (UC3) and the balance (UC10). Role admin edits (admin_update_payment_details); the shop views.
// The QR image is uploaded to the public bucket "shop-assets".
route(/^\/settings\/payment$/, async (el) => {
  const [{ data: au }, pd] = await Promise.all([db.auth.getUser(), db.from("shop_payment_details").select("*").eq("id", 1).maybeSingle().then(must)]);
  const d = pd ?? {};
  const isAdmin = window.ME?.role === "admin";
  const v = (k) => esc(d[k] ?? "");
  el.innerHTML = head("บัญชีรับเงิน", "บัญชีที่ลูกค้าใช้ชำระมัดจำและยอดคงเหลือ ข้อมูลนี้แสดงในหน้าชำระเงินของลูกค้า") + `
    <div class="grid profile-grid">
      <form class="card" id="pd" novalidate>
        <h2>โอนผ่านธนาคาร</h2>
        <label for="pd-bank">ธนาคาร</label><input id="pd-bank" maxlength="100" value="${v("bank_name")}" placeholder="เช่น ธนาคารกสิกรไทย" ${isAdmin ? "" : "disabled"}>
        <label for="pd-name" style="margin-top:10px">ชื่อบัญชี</label><input id="pd-name" maxlength="200" value="${v("account_name")}" ${isAdmin ? "" : "disabled"}>
        <label for="pd-num" style="margin-top:10px">เลขที่บัญชี</label><input id="pd-num" inputmode="numeric" maxlength="24" value="${v("account_number")}" placeholder="ตัวเลข 8–20 หลัก" ${isAdmin ? "" : "disabled"}>
        <h2 style="margin-top:18px">พร้อมเพย์ / QR</h2>
        <label for="pd-pp">หมายเลขพร้อมเพย์</label><input id="pd-pp" inputmode="numeric" maxlength="17" value="${v("promptpay_id")}" placeholder="เบอร์โทร 10 หลัก หรือเลขประจำตัว 13 หลัก" ${isAdmin ? "" : "disabled"}>
        <label style="margin-top:10px">รูป QR</label>
        <div class="row" style="align-items:flex-start">
          <img id="pd-qr-img" alt="ตัวอย่าง QR" style="width:120px;height:120px;object-fit:contain;border:1px solid var(--line);border-radius:8px;background:#fff" ${d.qr_url ? `src="${v("qr_url")}"` : "hidden"}>
          ${isAdmin ? `<div class="row"><input id="pd-qr-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>
            <button type="button" class="btn ghost sm" id="pd-qr-up">อัปโหลด QR</button><button type="button" class="btn ghost sm" id="pd-qr-rm" ${d.qr_url ? "" : "hidden"}>ลบ QR</button></div>` : ""}
        </div>
        <label for="pd-note" style="margin-top:10px">หมายเหตุถึงลูกค้า (ไม่บังคับ)</label><input id="pd-note" maxlength="500" value="${v("note")}" placeholder="เช่น ใส่เลขคำสั่งซื้อในบันทึกการโอน" ${isAdmin ? "" : "disabled"}>
        <div class="err" id="pd-err" hidden></div>
        ${isAdmin ? `<div class="row end" style="margin-top:14px"><button class="btn" id="pd-save">${icon("check", 16)}บันทึก</button></div>`
          : `<p class="small muted" style="margin-top:12px">เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขบัญชีรับเงินได้</p>`}
      </form>
      <div class="card"><h2>ตัวอย่างที่ลูกค้าเห็น</h2><div id="pd-prev"></div>
        <p class="small muted" style="margin-top:12px">${d.updated_at && d.updated_by ? `แก้ไขล่าสุด ${dateTH(d.updated_at, true)}` : "ยังไม่ได้ตั้งค่า ลูกค้าจะเห็นข้อความให้ติดต่อร้านเพื่อขอเลขบัญชี"}</p></div>
    </div>`;
  let qr = d.qr_url || "";
  const prev = () => {
    const num = $("#pd-num").value.trim(), pp = $("#pd-pp").value.trim();
    $("#pd-prev").innerHTML = num || pp
      ? `<dl class="spec2">${num ? `<dt>ธนาคาร</dt><dd>${esc($("#pd-bank").value)}</dd><dt>ชื่อบัญชี</dt><dd>${esc($("#pd-name").value)}</dd><dt>เลขที่บัญชี</dt><dd>${esc(num)}</dd>` : ""}${pp ? `<dt>พร้อมเพย์</dt><dd>${esc(pp)}</dd>` : ""}</dl>`
        + ($("#pd-note").value.trim() ? `<p class="small muted">${esc($("#pd-note").value.trim())}</p>` : "")
      : `<div class="err">ยังไม่มีบัญชี ลูกค้าจะเห็นข้อความให้ติดต่อร้านก่อนชำระเงิน</div>`;
    const img = $("#pd-qr-img"); img.hidden = !qr; if (qr) img.src = qr;
  };
  el.addEventListener("input", prev); prev();
  if (!isAdmin) return;
  const fail = (m) => { $("#pd-err").textContent = m; $("#pd-err").hidden = false; };
  $("#pd-qr-up").onclick = () => $("#pd-qr-file").click();
  $("#pd-qr-file").onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 2 * 1024 * 1024) return fail("รูป QR ต้องเป็น JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB");
    const path = `qr/${Date.now()}.${f.type.split("/")[1].replace("jpeg", "jpg")}`;
    const up = await db.storage.from("shop-assets").upload(path, f, { contentType: f.type, upsert: false });
    if (up.error) return fail("อัปโหลดไม่สำเร็จ: " + up.error.message);
    qr = db.storage.from("shop-assets").getPublicUrl(path).data.publicUrl;
    $("#pd-qr-rm").hidden = false; prev(); toast("อัปโหลด QR แล้ว กดบันทึกเพื่อให้ลูกค้าเห็น");
  };
  $("#pd-qr-rm").onclick = () => { qr = ""; $("#pd-qr-rm").hidden = true; prev(); };
  $("#pd").onsubmit = async (e) => {
    e.preventDefault(); $("#pd-err").hidden = true; $("#pd-save").disabled = true;
    try {
      await rpc("admin_update_payment_details", { p_bank: $("#pd-bank").value, p_account_name: $("#pd-name").value, p_account_number: $("#pd-num").value,
        p_promptpay: $("#pd-pp").value, p_qr_url: qr || null, p_note: $("#pd-note").value }, "บันทึกแล้ว ลูกค้าจะเห็นข้อมูลนี้");
    } catch (er) { fail(errText(er)); }
    $("#pd-save").disabled = false;
  };
});
