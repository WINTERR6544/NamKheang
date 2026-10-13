// Production > one job (UC6). One page that follows the job's stage:
//   ready  -> เริ่มงานผลิต: confirm readiness + the estimated finish date (required by factory_production 'started') -> 4 in_process
//   making -> ส่งงานเข้าสู่ QC (main action): confirm, finish -> 5 waiting_qc, finished_at recorded.
//             The plan card shows the dates; the estimated finish date can be rescheduled there
//             (later than before, or fixing a date before the start = 'delayed', the customer is told).
//   qc     -> read-only; QC is the next module
// Every action is factory_production (factory-only in the database); the page reloads from the database afterwards.
route(/^\/production\/(\d+)$/, async (el, [id]) => {
  const [j, ups] = await Promise.all([fetchJob(Number(id)), fetchProductionUpdates(Number(id))]);
  const o = j.o;
  setCrumbs("Production", o.order_code);
  el.onclick = null;
  const bad = badPlan(o);
  const TITLE = { ready: ["เริ่มงานผลิต", "ตรวจสอบความพร้อม กำหนดวันที่คาดว่าจะเสร็จ แล้วเริ่มผลิต"],
    making: ["งานกำลังผลิต", "ผลิตเสร็จแล้วให้ยืนยันเพื่อส่งตรวจ QC"],
    qc: ["รายละเอียดงานผลิต", "ผลิตเสร็จและส่งต่อทีม QC แล้ว"] }[j.stage];
  const done = { ready: 1, making: 3, qc: 4 }[j.stage];
  const STEPS = ["รับงานแล้ว", "เริ่มผลิต", "กำหนดวันเสร็จ", "ส่งตรวจ QC"];
  const STAGE_LABEL = { started: "เริ่มผลิต", in_progress: "กำหนดวันที่คาดว่าจะเสร็จใหม่", delayed: "เลื่อนวันที่คาดว่าจะเสร็จ (แจ้งลูกค้า)", finished: "ผลิตเสร็จสิ้น ส่งตรวจ QC" };
  // the earliest date a new estimate may take: today, and never before production started
  const minDate = [todayISO(), o.started_at ? isoOf(o.started_at) : ""].sort().pop();

  // order facts only; every production date lives in the plan card
  const summary = `<div class="card"><h2>สรุปงานผลิต</h2>
    <div class="row-sb"><div><div class="eyebrow">ORDER NO.</div><div class="code-lg">${esc(o.order_code)}</div></div>${stagePill(j)}</div><hr>
    <dl class="kv2">
      <div class="full"><dt>ลูกค้า</dt><dd>${esc(o.customers?.name ?? "-")}</dd></div>
      <div><dt>รุ่นเครื่อง</dt><dd>${esc(modelName(o))}<div class="small muted">${esc(o.capacity)}</div></dd></div>
      <div><dt>รับผลิตเมื่อ</dt><dd>${dateTH(j.responded_at)}</dd></div>
    </dl></div>`;
  const machine = `<div class="card"><h2>ข้อมูลเครื่อง</h2><div class="muted small">รุ่นที่ร้านยืนยันกับลูกค้า</div>
    <dl class="kv2"><div><dt>รุ่นเครื่อง</dt><dd>${esc(modelName(o))}</dd></div><div><dt>ประเภทเครื่อง</dt><dd>${esc(o.machine_type)}</dd></div>
      <div><dt>กำลังผลิต</dt><dd>${esc(o.capacity)}</dd></div>${o.machine_models?.description ? `<div><dt>รายละเอียดรุ่น</dt><dd>${esc(o.machine_models.description)}</dd></div>` : ""}</dl></div>`;
  const plan = `<div class="card"><h2>แผนการผลิต</h2>
    <dl class="kv2">
      <div><dt>วันเริ่มผลิต</dt><dd>${o.started_at ? dateTimeTH(o.started_at) : "-"}</dd></div>
      <div><dt>วันที่คาดว่าจะเสร็จ</dt><dd>${o.est_finish_date ? dateTH(o.est_finish_date) : "-"}${dueText(j) && !bad ? `<div class="small">${dueText(j)}</div>` : ""}</dd></div>
      ${o.finished_at ? `<div class="full"><dt>ผลิตเสร็จเมื่อ</dt><dd>${dateTimeTH(o.finished_at)}</dd></div>` : ""}
    </dl>
    ${j.stage === "making" ? `${bad ? `<div class="err" style="margin-top:14px">วันที่คาดว่าจะเสร็จ (${dateTH(o.est_finish_date)}) อยู่ก่อนวันเริ่มผลิต (${dateTH(o.started_at)}) กรุณากำหนดวันใหม่ ระบบจะแจ้งลูกค้าว่าเลื่อนวันเสร็จ</div>` : ""}
      <hr><div id="resched" ${bad ? "" : "hidden"}>
        <div class="lbl-b" id="el">วันที่คาดว่าจะเสร็จ (ใหม่) *</div><input type="date" id="est" aria-labelledby="el" min="${minDate}">
        <div class="small" id="eh" style="margin:4px 0 12px"></div>
        <div class="row end">${bad ? "" : `<button class="btn ghost" id="cancel">ยกเลิก</button>`}<button class="btn" id="save" disabled>${icon("calendar", 16)}ยืนยันวันใหม่</button></div>
      </div>
      ${bad ? "" : `<button class="btn ghost" id="open">${icon("calendar", 16)}เลื่อนวันที่คาดว่าจะเสร็จ</button>`}` : ""}
  </div>`;
  const timeline = `<div class="card"><h2>ประวัติการผลิต</h2>${ups.length ? `<ol class="tline">${ups.map((u) => `<li><span class="d"></span><div>
      <b>${STAGE_LABEL[u.stage] ?? esc(u.stage)}</b>${u.est_finish_date ? ` · คาดว่าจะเสร็จ ${dateTH(u.est_finish_date)}` : ""}
      <div class="small muted">${dateTimeTH(u.created_at)}</div></div></li>`).join("")}</ol>`
    : `<p class="small muted">ยังไม่มีประวัติ</p>`}</div>`;

  let left = "", right = "";
  if (j.stage === "ready") {
    left = machine;
    right = `<div class="card primary"><h2>เริ่มผลิต</h2><div class="muted small">ระบบจะเปลี่ยนสถานะเป็น "กำลังผลิต" และแจ้งวันที่คาดว่าจะเสร็จให้ร้านและลูกค้า</div>
      <div class="lbl-b" id="el">วันที่คาดว่าจะเสร็จ *</div><input type="date" id="est" aria-labelledby="el" min="${minDate}">
      <div class="small muted" style="margin-top:4px">ต้องไม่ก่อนวันนี้</div>
      <label class="check"><input type="checkbox" id="ok"><span>ตรวจสอบสเปก จำนวนเครื่อง และความพร้อมของสายการผลิตครบแล้ว</span></label>
      <button class="btn wide" id="go" disabled>${icon("play", 16)}เริ่มผลิต</button></div>${summary}`;
  } else if (j.stage === "making") {
    left = `${plan}${timeline}`;
    right = `<div class="card primary"><h2>ส่งงานเข้าสู่ QC</h2>
      <div class="note-box small">เมื่อยืนยันผลิตเสร็จสิ้น ระบบจะบันทึกเวลาที่เสร็จ เปลี่ยนสถานะเป็น <b>"รอตรวจ QC"</b> และแจ้งร้าน</div>
      <label class="check"><input type="checkbox" id="ok"><span>ยืนยันว่าผลิตครบ อุปกรณ์ครบ และทดสอบภายในโรงงานแล้ว</span></label>
      <button class="btn wide" id="go" disabled>${icon("check", 16)}ผลิตเสร็จสิ้น</button></div>${summary}`;
  } else {
    left = `${plan}${timeline}`;
    right = `<div class="card primary"><h2>ส่งตรวจ QC แล้ว</h2><p class="small muted">ผลิตเสร็จเมื่อ ${dateTimeTH(o.finished_at)} · ติดตามต่อได้ที่ QC / Rework</p></div>${summary}`;
  }

  el.innerHTML = `<div class="head"><div><h1>${TITLE[0]}</h1><div class="muted">${esc(o.order_code)} · ${TITLE[1]}</div></div>
      <a class="btn ghost" href="#/production">${icon("arrowLeft", 16)}กลับรายการงานผลิต</a></div>
    <div class="card steps"><ol class="psteps">${STEPS.map((s, i) => `<li class="${i < done ? "done" : i === done ? "on" : ""}">
      <span class="num">${i < done ? icon("check", 14) : i + 1}</span>${s}</li>`).join("")}</ol></div>
    <div class="grid cols-prod"><div class="stack">${left}</div><div class="stack">${right}</div></div>`;

  const est = $("#est", el), ok = $("#ok", el), go = $("#go", el);
  const run = async (btn, stage, p_est, msg) => {
    btn.disabled = true;
    try {
      await rpc("factory_production", { p_order: o.order_id, p_stage: stage, p_est, p_note: null }, msg);
      refreshShell();
      // finished -> 5 waiting_qc: back to the list, which no longer shows it; otherwise reload this page from the database
      if (stage === "finished") location.hash = "#/production"; else navigate();
    } catch (e) { toast(errText(e), true); btn.disabled = false; }
  };
  if (j.stage === "ready") {
    const sync = () => { go.disabled = !(ok.checked && est.value && est.value >= minDate); };
    est.oninput = sync; ok.onchange = sync;
    go.onclick = () => run(go, "started", est.value, "เริ่มผลิตแล้ว แจ้งวันที่คาดว่าจะเสร็จให้ร้านและลูกค้าแล้ว");
  } else if (j.stage === "making") {
    ok.onchange = () => { go.disabled = !ok.checked; };
    go.onclick = () => run(go, "finished", null, "ผลิตเสร็จสิ้น ส่งตรวจ QC แล้ว");
    // reschedule: later than the current date (or fixing a date before the start) counts as a delay and the customer is told
    const save = $("#save", el), box = $("#resched", el);
    const delayed = () => bad || (o.est_finish_date && est.value > o.est_finish_date);
    const valid = () => est.value && est.value >= minDate && est.value !== o.est_finish_date;
    const hint = () => {
      $("#eh", el).innerHTML = !est.value ? `<span class="muted">ต้องไม่ก่อนวันนี้และวันเริ่มผลิต</span>`
        : est.value < minDate ? `<span class="red">ต้องไม่ก่อน ${dateTH(minDate)}</span>`
        : est.value === o.est_finish_date ? `<span class="muted">เป็นวันเดิม</span>`
        : delayed() ? `<span class="amber">ช้ากว่าเดิม · ระบบจะแจ้งลูกค้าว่าเลื่อนวันเสร็จ</span>` : `<span class="muted">เร็วกว่าเดิม</span>`;
      save.disabled = !valid();
    };
    est.oninput = hint; hint();
    $("#open", el)?.addEventListener("click", (e) => { box.hidden = false; e.currentTarget.hidden = true; est.focus(); });
    $("#cancel", el)?.addEventListener("click", () => { box.hidden = true; $("#open", el).hidden = false; est.value = ""; hint(); });
    save.onclick = () => run(save, delayed() ? "delayed" : "in_progress", est.value,
      delayed() ? "บันทึกวันใหม่แล้ว แจ้งลูกค้าว่าเลื่อนวันเสร็จ" : "บันทึกวันที่คาดว่าจะเสร็จใหม่แล้ว");
  }
});
