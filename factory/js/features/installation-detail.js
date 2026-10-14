// Installation > one job (UC8 view, UC9 confirm, UC10 fix visit), on one page:
//   left  - a forwarded customer problem (fix visit), the on-site test checklist (when booked), customer and site, machine
//   right - confirm card, the appointment the shop booked and its history
// The database lets the factory confirm only after a passing on-site QC recorded after the current appointment was booked:
//   every item passes -> staff_qc_submit('onsite') then staff_confirm_installed -> 9 installed (shop and customer told)
//   any item fails    -> staff_qc_submit('onsite') only; the order stays at 8, fix and test again
// If a passing on-site QC is already on file for this appointment (e.g. the confirm failed), only the confirm is sent.
// The old #/installation/:id/confirm address opens this page.
route(/^\/installation\/(\d+)(?:\/confirm)?$/, async (el, [id]) => {
  if (location.hash.split("?")[0].endsWith("/confirm")) history.replaceState(null, "", `#/installation/${id}`);
  const [j, items, qc, onsite] = await Promise.all([fetchInstallJob(Number(id)), fetchQcItems(), fetchQcRounds([Number(id)]), fetchQcRounds([Number(id)], "onsite")]);
  const { appts, probs } = await fetchInstallExtras([j.o.order_id]);
  const o = j.o, list = appts.get(o.order_id) ?? [], appt = list.find((a) => a.status === "scheduled") ?? null;
  const prob = openProblem(j, probs.get(o.order_id)), st = instState(j, appt, probs.get(o.order_id));
  const passedQc = (qc.get(o.order_id) ?? []).find((r) => !r.failed.length);
  setCrumbs("Installation", o.order_code);
  el.onclick = null;
  const canConfirm = o.status === 8 && !!appt;
  const early = appt && isoOf(appt.install_datetime) > todayISO();
  const map = o.install_address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.install_address)}` : "";
  // on-site rounds for this appointment only (the database counts rounds checked after the appointment was booked)
  const rounds = canConfirm ? (onsite.get(o.order_id) ?? []).filter((r) => r.at > appt.created_at) : [];
  const passedRound = rounds.length && !rounds[0].failed.length ? rounds[0] : null;
  const lastFail = rounds.find((r) => r.failed.length);
  const prevFail = new Map((rounds[0]?.failed ?? []).map((i) => [i.item_id, i.note]));

  const problem = prob ? `<div class="card prob"><h2>ปัญหาจากการตรวจรับของลูกค้า</h2>
    <div class="muted small">ลูกค้าแจ้งเมื่อ ${dateTimeTH(prob.checked_at)} · ร้านส่งต่อให้โรงงานเมื่อ ${dateTimeTH(prob.forwarded_at)}</div>
    <div class="quote">${esc(prob.note || "-")}</div></div>` : "";
  const checklist = !canConfirm ? "" : passedRound ? `<div class="card"><div class="row-sb"><h2>ผลติดตั้งและทดสอบจริง</h2><span class="pill dot ok">ผ่านแล้ว</span></div>
      <div class="muted small">บันทึก QC หน้างานรอบ ${passedRound.round_no} ผ่านทุกข้อแล้วเมื่อ ${dateTimeTH(passedRound.at)} · ยืนยันติดตั้งเสร็จได้เลย</div></div>`
    : !items.length ? `<div class="card"><div class="err">โหลดหัวข้อทดสอบไม่ได้ · ต้องรัน migration factory_qc ก่อน</div></div>`
    : `<div class="card" id="test"><div class="row-sb"><h2>ผลติดตั้งและทดสอบจริง</h2><span class="pill dot" id="cnt"></span></div>
      <div class="muted small">ทดสอบหน้างานครบทุกหัวข้อก่อนปิดงาน (QC หน้างาน${rounds.length ? ` รอบ ${rounds[0].round_no + 1}` : ""}) · หัวข้อที่ไม่ผ่านต้องระบุจุดที่ต้องแก้</div>
      ${lastFail ? `<div class="note-box small amber">ทดสอบรอบ ${lastFail.round_no} ไม่ผ่าน ${lastFail.failed.length} ข้อ · แก้ไขแล้วทดสอบใหม่ก่อนยืนยัน</div>` : ""}
      ${items.map((i) => `<div class="qc-item" data-i="${i.item_id}"><div class="row-sb"><div>${qcTitle(i, true)}</div>
        <div class="seg2" role="radiogroup" aria-label="${esc(i.item_name)}">
          <label><input type="radio" name="r${i.item_id}" value="1"><span>ผ่าน</span></label>
          <label class="no"><input type="radio" name="r${i.item_id}" value="0"><span>ไม่ผ่าน</span></label></div></div>
        ${prevFail.has(i.item_id) ? `<div class="small amber">ทดสอบรอบก่อนไม่ผ่าน${prevFail.get(i.item_id) ? `: ${esc(prevFail.get(i.item_id))}` : ""}</div>` : ""}
        <input class="fix" placeholder="${esc(i.fix_example_th || "ระบุจุดที่ต้องแก้")}" maxlength="300" hidden aria-label="จุดที่ต้องแก้ ${esc(i.item_name)}"></div>`).join("")}</div>`;
  const site = `<div class="card"><h2>ลูกค้าและสถานที่ติดตั้ง</h2><div class="muted small">ข้อมูลติดต่อและเส้นทางสำหรับทีมติดตั้ง</div>
    <dl class="kv2"><div><dt>ลูกค้า / ผู้ประสานงาน</dt><dd>${esc(o.customers?.name ?? "-")}</dd></div>
      <div><dt>เบอร์ติดต่อ</dt><dd>${esc(o.customers?.phone || "-")}</dd></div></dl><hr>
    <div class="small muted">ที่อยู่ติดตั้งเต็ม</div><div style="font-weight:500;margin:3px 0 12px">${esc(o.install_address ?? "-")}</div>
    ${map ? `<a class="btn ghost" href="${map}" target="_blank" rel="noopener">${icon("pin", 16)}เปิดแผนที่สถานที่ติดตั้ง</a>` : ""}</div>`;
  const machine = `<div class="card"><h2>ข้อมูลเครื่องและเงื่อนไขติดตั้ง</h2>
    <div class="muted small">ผลิตเสร็จ ${dateTH(o.finished_at)}${passedQc ? ` · ผ่าน QC รอบ ${passedQc.round_no} (${dateTH(passedQc.at)})` : " · ผ่าน QC"} · พร้อมส่งมอบ</div>
    <dl class="spec2"><dt>เครื่อง</dt><dd>${esc(modelName(o))} · ${esc(o.machine_type)}</dd><dt>กำลังผลิต</dt><dd>${esc(o.capacity)}</dd>
      <dt>ระบบไฟฟ้า</dt><dd>${esc(o.install_power || "-")}</dd><dt>พื้นที่ติดตั้ง</dt><dd>${esc(o.install_space || "-")}</dd></dl></div>`;

  const action = canConfirm ? `<div class="card primary"><div class="row-sb" style="justify-content:flex-start">${icon("shield", 20)}<h2 style="margin:0">${st === "fix" ? "เข้าแก้ไขและยืนยัน" : "ยืนยันติดตั้งและทดสอบเสร็จ"}</h2></div>
      ${early ? `<div class="note-box small amber">ยังไม่ถึงวันนัด (${dateTH(appt.install_datetime)}) · ยืนยันได้เมื่อติดตั้งและทดสอบหน้างานจริงแล้วเท่านั้น</div>` : ""}
      <div class="note-box small" id="sum"></div>
      <label class="check"><input type="checkbox" id="ok"><span>โรงงานยืนยันว่าติดตั้งและทดสอบจริงครบทุกข้อ ตรงกับเครื่องและลูกค้า พร้อมส่งมอบโดยไม่มีงานค้าง</span></label>
      <button class="btn wide" id="go" disabled></button></div>`
    : o.status === 9 ? `<div class="card primary"><h2>${st === "reported" ? "ลูกค้าแจ้งปัญหา" : "ติดตั้งเสร็จแล้ว"}</h2>
      <p class="small muted">${st === "reported" ? "ร้านจะนัดวันเข้าแก้ไขกับลูกค้าและโรงงาน แล้วงานจะกลับมาที่ตารางนัด" : `ยืนยันติดตั้งเสร็จเมื่อ ${dateTimeTH(o.installed_at)} · รอลูกค้าตรวจรับและชำระยอดคงเหลือกับร้าน`}</p></div>` : "";
  const apptCard = `<div class="card"><h2>วันนัดติดตั้ง</h2>${instPill(st)}
    ${appt ? `<div class="big-date">${dateTH(appt.install_datetime)}</div><div class="muted">${timeOnly(appt.install_datetime)}</div><hr>
      <dl class="kv2"><div class="full"><dt>ร้านบันทึกนัดเมื่อ</dt><dd>${dateTimeTH(appt.created_at)}</dd></div>
        <div class="full"><dt>การเลื่อนนัด</dt><dd>${appt.reschedule_count ? `เลื่อนแล้ว ${appt.reschedule_count} ครั้ง` : "นัดเดิม ไม่มีการเลื่อน"}</dd></div></dl>`
      : `<p class="muted">${o.status === 7 ? "ร้านกำลังประสานวันนัดกับลูกค้า" : o.status === 9 ? `ติดตั้งเสร็จเมื่อ ${dateTimeTH(o.installed_at)}` : "-"}</p>`}
    <p class="small muted" style="margin-top:12px">ต้องการเลื่อนนัด ให้แจ้งร้าน ร้านเป็นผู้บันทึกวันและเวลาใหม่ และระบบจะแจ้งลูกค้ากับโรงงาน</p></div>`;
  const hist = list.length > 1 ? `<div class="card"><h2>ประวัติวันนัด</h2><ol class="tline">${list.map((a) => `<li><span class="d"></span><div>
      <b>${dateTH(a.install_datetime)} · ${timeOnly(a.install_datetime)}</b> <span class="small muted">${{ scheduled: "นัดปัจจุบัน", rescheduled: "เลื่อนแล้ว", completed: "ติดตั้งแล้ว", cancelled: "ยกเลิก" }[a.status] ?? esc(a.status)}</span>
      ${a.reschedule_reason ? `<div class="small">เหตุผลที่เลื่อน: ${esc(a.reschedule_reason)}</div>` : ""}</div></li>`).join("")}</ol></div>` : "";
  const STEPS = appt ? [`ยืนยันนัด ${dateTH(appt.install_datetime)}`, "ติดตั้งเครื่อง", "ทดสอบหน้างาน", "ตรวจสอบก่อนยืนยัน"] : [];

  el.innerHTML = `<div class="head"><div><h1>${canConfirm ? "งานติดตั้งและยืนยันเสร็จ" : "รายละเอียดงานติดตั้ง"}</h1>
      <div class="muted">${esc(o.order_code)} · ${esc(o.customers?.name ?? "")}${canConfirm ? ` · ${st === "fix" ? "เข้าแก้ไขปัญหาที่ลูกค้าแจ้ง · " : ""}ทดสอบหน้างานแล้วยืนยันเพื่อแจ้งร้านและลูกค้า` : ""}</div></div>
      <a class="btn ghost" href="#/installation">${icon("arrowLeft", 16)}กลับตารางนัด</a></div>
    ${canConfirm ? `<div class="card steps"><ol class="psteps" id="steps">${STEPS.map((s, i) => `<li data-s="${i}"><span class="num">${i + 1}</span>${s}</li>`).join("")}</ol></div>` : ""}
    <div class="grid cols-prod"><div class="stack">${problem}${checklist}${site}${machine}</div><div class="stack">${action}${apptCard}${hist}</div></div>`;
  if (!canConfirm) return;

  const ok = $("#ok", el), go = $("#go", el), rows = $$(".qc-item[data-i]", el);
  const read = () => rows.map((r) => ({ item_id: Number(r.dataset.i), v: $("input[type=radio]:checked", r)?.value, note: $(".fix", r).value.trim() }));
  const setSteps = (k) => $$("#steps li", el).forEach((li, i) => {
    li.className = i < k ? "done" : i === k ? "on" : "";
    $(".num", li).innerHTML = i < k ? icon("check", 14) : i + 1;
  });
  const sync = () => {
    const res = read();
    rows.forEach((r, k) => { $(".fix", r).hidden = res[k].v !== "0"; r.classList.toggle("failed", res[k].v === "0"); });
    const pass = res.filter((x) => x.v === "1").length, fail = res.filter((x) => x.v === "0").length, left = res.length - pass - fail;
    const missing = res.some((x) => x.v === "0" && !x.note);
    if ($("#cnt", el)) $("#cnt", el).textContent = `${pass} / ${res.length} ผ่านแล้ว`;
    const allPass = passedRound || (!left && !fail && rows.length);
    setSteps(allPass ? 3 : 2);
    $("#sum", el).innerHTML = allPass ? `ทดสอบผ่านทุกข้อ → สถานะเป็น <b>"ติดตั้งแล้ว"</b> แจ้งร้าน และแจ้งลูกค้าให้ตรวจรับ`
      : left ? `ทดสอบหน้างานในการ์ด "ผลติดตั้งและทดสอบจริง" · ยังไม่ได้ทดสอบ ${left} หัวข้อ`
      : `ไม่ผ่าน ${fail} หัวข้อ → บันทึกผลไว้ งานยังอยู่ที่นัดนี้ แก้ไขแล้วทดสอบใหม่${missing ? `<div class="red">ระบุจุดที่ต้องแก้ให้ครบ</div>` : ""}`;
    go.innerHTML = fail && !passedRound ? `${icon("x", 16)}บันทึกผลทดสอบไม่ผ่าน` : `${icon("check", 16)}ยืนยันติดตั้งเสร็จและแจ้งร้าน`;
    go.className = "btn wide" + (!allPass && fail ? " red" : "");
    go.disabled = !(ok.checked && (allPass || (!left && !missing && rows.length)));
  };
  el.addEventListener("input", sync); el.addEventListener("change", sync); sync();
  go.onclick = async () => {
    go.disabled = true;
    const res = read(), allPass = passedRound || res.every((x) => x.v === "1");
    try {
      if (!passedRound) await rpc("staff_qc_submit", { p_order: o.order_id, p_stage: "onsite",
        p_results: res.map((x) => ({ item_id: x.item_id, passed: x.v === "1", note: x.v === "0" ? x.note : null })) });
      if (!allPass) { toast("บันทึกผลทดสอบหน้างานไม่ผ่านแล้ว แก้ไขแล้วทดสอบใหม่", true); navigate(); return; }
      await rpc("staff_confirm_installed", { p_order: o.order_id }, "ยืนยันติดตั้งเสร็จแล้ว แจ้งร้านและลูกค้าให้ตรวจรับ");
      refreshShell(); navigate(); // reload: the page now shows the installed state
    } catch (e) { toast(errText(e), true); navigate(); }
  };
});
