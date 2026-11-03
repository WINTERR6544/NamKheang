// Admin > Payment details: the shop's bank account, PromptPay and QR that customers see when they pay
// the deposit (UC3) and the balance (UC10). Role admin edits (admin_update_payment_details); the shop views.
// The QR image is uploaded to the public bucket "shop-assets".
route(/^\/settings\/payment$/, async (el) => {
  const [{ data: au }, pd] = await Promise.all([db.auth.getUser(), db.from("shop_payment_details").select("*").eq("id", 1).maybeSingle().then(must)]);
  const d = pd ?? {};
  const isAdmin = window.ME?.role === "admin";
  const v = (k) => esc(d[k] ?? "");
  el.innerHTML = head("Payment details", "Where customers pay the deposit and the balance. Customers see this on their payment page") + `
    <div class="grid profile-grid">
      <form class="card" id="pd" novalidate>
        <h2>Bank transfer</h2>
        <label for="pd-bank">Bank</label><input id="pd-bank" maxlength="100" value="${v("bank_name")}" placeholder="e.g. Kasikornbank" ${isAdmin ? "" : "disabled"}>
        <label for="pd-name" style="margin-top:10px">Account name</label><input id="pd-name" maxlength="200" value="${v("account_name")}" ${isAdmin ? "" : "disabled"}>
        <label for="pd-num" style="margin-top:10px">Account number</label><input id="pd-num" inputmode="numeric" maxlength="24" value="${v("account_number")}" placeholder="8–20 digits" ${isAdmin ? "" : "disabled"}>
        <h2 style="margin-top:18px">PromptPay / QR</h2>
        <label for="pd-pp">PromptPay ID</label><input id="pd-pp" inputmode="numeric" maxlength="17" value="${v("promptpay_id")}" placeholder="10-digit phone or 13-digit ID" ${isAdmin ? "" : "disabled"}>
        <label style="margin-top:10px">QR image</label>
        <div class="row" style="align-items:flex-start">
          <img id="pd-qr-img" alt="QR preview" style="width:120px;height:120px;object-fit:contain;border:1px solid var(--line);border-radius:8px;background:#fff" ${d.qr_url ? `src="${v("qr_url")}"` : "hidden"}>
          ${isAdmin ? `<div class="row"><input id="pd-qr-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>
            <button type="button" class="btn ghost sm" id="pd-qr-up">Upload QR</button><button type="button" class="btn ghost sm" id="pd-qr-rm" ${d.qr_url ? "" : "hidden"}>Remove QR</button></div>` : ""}
        </div>
        <label for="pd-note" style="margin-top:10px">Note for customers (optional)</label><input id="pd-note" maxlength="500" value="${v("note")}" placeholder="e.g. Use the order number as the transfer note" ${isAdmin ? "" : "disabled"}>
        <div class="err" id="pd-err" hidden></div>
        ${isAdmin ? `<div class="row end" style="margin-top:14px"><button class="btn" id="pd-save">${icon("check", 16)}Save</button></div>`
          : `<p class="small muted" style="margin-top:12px">Only an admin can change the payment details.</p>`}
      </form>
      <div class="card"><h2>What customers see</h2><div id="pd-prev"></div>
        <p class="small muted" style="margin-top:12px">${d.updated_at && d.updated_by ? `Last changed ${dateTH(d.updated_at, true)}` : "Not set yet: customers are asked to contact the shop for the account."}</p></div>
    </div>`;
  let qr = d.qr_url || "";
  const prev = () => {
    const num = $("#pd-num").value.trim(), pp = $("#pd-pp").value.trim();
    $("#pd-prev").innerHTML = num || pp
      ? `<dl class="spec2">${num ? `<dt>Bank</dt><dd>${esc($("#pd-bank").value)}</dd><dt>Account name</dt><dd>${esc($("#pd-name").value)}</dd><dt>Account number</dt><dd>${esc(num)}</dd>` : ""}${pp ? `<dt>PromptPay</dt><dd>${esc(pp)}</dd>` : ""}</dl>`
        + ($("#pd-note").value.trim() ? `<p class="small muted">${esc($("#pd-note").value.trim())}</p>` : "")
      : `<div class="err">No account yet. Customers are asked to contact the shop before paying.</div>`;
    const img = $("#pd-qr-img"); img.hidden = !qr; if (qr) img.src = qr;
  };
  el.addEventListener("input", prev); prev();
  if (!isAdmin) return;
  const fail = (m) => { $("#pd-err").textContent = m; $("#pd-err").hidden = false; };
  $("#pd-qr-up").onclick = () => $("#pd-qr-file").click();
  $("#pd-qr-file").onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 2 * 1024 * 1024) return fail("The QR must be a JPG, PNG or WebP under 2 MB");
    const path = `qr/${Date.now()}.${f.type.split("/")[1].replace("jpeg", "jpg")}`;
    const up = await db.storage.from("shop-assets").upload(path, f, { contentType: f.type, upsert: false });
    if (up.error) return fail("Upload failed: " + up.error.message);
    qr = db.storage.from("shop-assets").getPublicUrl(path).data.publicUrl;
    $("#pd-qr-rm").hidden = false; prev(); toast("QR uploaded. Press Save to publish it");
  };
  $("#pd-qr-rm").onclick = () => { qr = ""; $("#pd-qr-rm").hidden = true; prev(); };
  $("#pd").onsubmit = async (e) => {
    e.preventDefault(); $("#pd-err").hidden = true; $("#pd-save").disabled = true;
    try {
      await rpc("admin_update_payment_details", { p_bank: $("#pd-bank").value, p_account_name: $("#pd-name").value, p_account_number: $("#pd-num").value,
        p_promptpay: $("#pd-pp").value, p_qr_url: qr || null, p_note: $("#pd-note").value }, "Saved. Customers now see these details");
    } catch (er) { fail(errText(er)); }
    $("#pd-save").disabled = false;
  };
});
