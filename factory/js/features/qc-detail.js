// QC / Rework > one order (UC7). One page that follows the order's status:
//   5 waiting_qc -> ตรวจ QC: pass / fail every active checklist item (a failed item needs what to fix) -> staff_qc_submit
//                   the round then waits for the shop (state "review"): the shop passes it -> 7, or sends it back -> 6
//   6 rework     -> แก้ไขงานจากผล QC: the items the shop sent back and its note; confirm fixed -> staff_rework_done -> 5 (next round)
//   7 qc_passed  -> read-only result; the shop books the install
route(/^\/qc\/(\d+)$/, async (el, [id]) => {
  const [j, items, maxRounds, roundsBy] = await Promise.all([fetchQcJob(Number(id)), fetchQcItems(), qcMaxRounds(), fetchQcRounds([Number(id)])]);
  const o = j.o, rounds = roundsBy.get(o.order_id) ?? [], last = rounds[0];
  const st = qcState(j, rounds), next = (last?.round_no ?? 0) + 1;
  setCrumbs("QC / แก้ไข", o.order_code);
  el.onclick = null;
  const review = st === "review"; // the latest round is recorded and waits for the shop
  const TITLE = review ? ["รอร้านตรวจผล QC", `QC รอบ ${last.round_no} · ส่งผลให้ร้านแล้ว`] : { 5: ["ตรวจ QC", `QC รอบ ${next} · ตรวจทุกหัวข้อแล้วบันทึกผล`], 6: ["แก้ไขงานจากผล QC", `QC รอบ ${last?.round_no} ไม่ผ่าน · แก้ไขทุกจุดแล้วส่งตรวจใหม่`],
    7: ["ผลการตรวจ QC", `ผ่าน QC รอบ ${last?.round_no} · รอร้านนัดวันติดตั้ง`] }[o.status];
  const shopNote = (r) => r?.review?.note && !/^Recorded before/.test(r.review.note) ? `<div class="note-box small"><b>ร้านแจ้ง:</b> ${esc(r.review.note)}</div>` : "";
  const STEPS = review ? ["ผลิตเสร็จ", `ตรวจ QC รอบ ${last.round_no}`, "ร้านตรวจผล", "ผ่าน QC"]
    : o.status === 5 ? ["ผลิตเสร็จ", `ตรวจ QC รอบ ${next}`, "ร้านตรวจผล", "ผ่าน QC"]
    : o.status === 6 ? ["ผลิตเสร็จ", `QC รอบ ${last?.round_no} ไม่ผ่าน`, "แก้ไขงาน", "ส่งตรวจ QC ใหม่"] : ["ผลิตเสร็จ", "ตรวจ QC", "แก้ไขงาน", "ผ่าน QC"];
  const done = review ? 2 : { 5: 1, 6: 2, 7: 4 }[o.status];
  const overLimit = rounds.filter((r) => r.failed.length).length >= maxRounds;

  const job = `<div class="card"><div class="row-sb"><h2>งานที่ต้องตรวจ QC</h2>${qcPill(st)}</div>
    <div class="code-lg" style="margin:6px 0 14px">${esc(o.order_code)}</div>
    <dl class="kv3">
      <div><dt>ลูกค้า</dt><dd>${esc(o.customers?.name ?? "-")}</dd></div>
      <div><dt>รุ่นเครื่อง</dt><dd>${esc(modelName(o))} · ${esc(o.capacity)}</dd></div>
      <div><dt>วันที่คาดว่าจะเสร็จ</dt><dd>${o.est_finish_date ? dateTH(o.est_finish_date) : "-"}</dd></div>
      <div><dt>วันเริ่มผลิต</dt><dd>${o.started_at ? dateTH(o.started_at) : "-"}</dd></div>
      <div><dt>ผลิตเสร็จจริง</dt><dd>${o.finished_at ? dateTH(o.finished_at) : "-"}</dd></div>
    </dl></div>`;
  const history = `<div class="card"><h2>รอบ QC และประวัติงาน</h2>${rounds.length ? `<ol class="tline">${rounds.map((r) => `<li><span class="d ${r.failed.length ? "bad" : ""}"></span><div>
      <b>QC รอบ ${r.round_no} · ${r.failed.length ? `ไม่ผ่าน ${r.failed.length} ข้อ` : "ผ่านทุกข้อ"}</b><div class="small muted">${dateTimeTH(r.at)}</div></div></li>`).join("")}</ol>`
    : `<p class="small muted">ยังไม่มีผลตรวจ</p>`}
    ${o.status !== 7 ? `<hr><div class="small muted">รอบตรวจถัดไป</div><b>QC รอบ ${o.status === 5 ? next : next}${o.status === 6 ? " · หลังแก้ไขเสร็จ" : ""}</b>` : ""}</div>`;
  const limit = overLimit ? `<div class="err">ไม่ผ่าน QC ครบ ${maxRounds} รอบแล้ว ร้านอาจพิจารณาเปลี่ยนโรงงาน</div>` : "";
  const itemsCard = (title, sub, list, badge) => `<div class="card"><div class="row-sb"><h2>${title}</h2>${badge ?? ""}</div><div class="muted small">${sub}</div>
    ${list.map((i) => `<div class="qc-item"><div class="row-sb"><div>${qcTitle(i.qc_items ?? i, false)}</div>
      <span class="pill dot ${i.passed ? "ok" : "bad"}">${i.passed ? "ผ่าน" : "ไม่ผ่าน"}</span></div>
      ${i.note ? `<div class="small"><span class="muted">จุดที่ต้องแก้:</span> ${esc(i.note)}</div>` : ""}</div>`).join("")}</div>`;

  let left = "", right = "";
  if (review) {
    left = itemsCard(`ผลตรวจ QC รอบ ${last.round_no}`, `บันทึกเมื่อ ${dateTimeTH(last.at)} · ${last.failed.length ? `ไม่ผ่าน ${last.failed.length} หัวข้อ` : "ผ่านทุกหัวข้อ"}`, last.items);
    right = `<div class="card primary"><h2>รอร้านตรวจผล</h2><p class="small muted">ร้านจะตรวจผลรอบนี้ แล้วกดผ่าน QC หรือส่งกลับให้แก้ไขพร้อมรายละเอียด โรงงานจะได้รับแจ้งทันที</p></div>${limit}${history}`;
  } else if (o.status === 5) {
    const prevFail = new Map((last?.failed ?? []).map((i) => [i.item_id, i.note]));
    left = !items.length ? `<div class="card"><div class="err">โหลดหัวข้อ QC ไม่ได้ · ต้องรัน migration factory_qc ก่อน (ให้โรงงานอ่าน qc_items ได้)</div></div>`
      : `<div class="card"><div class="row-sb"><h2>รายการตรวจ QC · รอบ ${next}</h2><span class="pill dot">${items.length} หัวข้อ</span></div>
        <div class="muted small">เลือกผ่านหรือไม่ผ่านทุกหัวข้อ หัวข้อที่ไม่ผ่านต้องระบุจุดที่ต้องแก้</div>
        ${items.map((i) => `<div class="qc-item" data-i="${i.item_id}"><div class="row-sb"><div>${qcTitle(i, true)}</div>
          <div class="seg2" role="radiogroup" aria-label="${esc(i.item_name)}">
            <label><input type="radio" name="r${i.item_id}" value="1"><span>ผ่าน</span></label>
            <label class="no"><input type="radio" name="r${i.item_id}" value="0"><span>ไม่ผ่าน</span></label></div></div>
          ${prevFail.has(i.item_id) ? `<div class="small amber">รอบ ${last.round_no} ไม่ผ่าน${prevFail.get(i.item_id) ? `: ${esc(prevFail.get(i.item_id))}` : ""}</div>` : ""}
          <input class="fix" placeholder="${esc(i.fix_example_th || "ระบุจุดที่ต้องแก้")}" maxlength="300" hidden aria-label="จุดที่ต้องแก้ ${esc(i.item_name)}"></div>`).join("")}</div>`;
    right = `<div class="card primary"><h2>ยืนยันผล QC</h2>
      <div class="note-box small" id="sum">ยังไม่ได้ตรวจ</div>
      <label class="check"><input type="checkbox" id="ok"><span>ตรวจเครื่องครบทุกหัวข้อแล้ว และผลที่บันทึกถูกต้อง</span></label>
      <button class="btn wide" id="go" disabled>${icon("check", 16)}บันทึกผล QC</button></div>${limit}${history}`;
  } else if (o.status === 6) {
    left = shopNote(last) + itemsCard("รายการที่ร้านส่งกลับให้แก้", `ผลตรวจรอบ ${last?.round_no} · ต้องแก้ไขทั้ง ${last?.toFix.length ?? 0} จุดก่อนส่งตรวจใหม่`, (last?.toFix ?? []).map((i) => ({ ...i, passed: false })),
      `<span class="pill dot bad">${last?.toFix.length ?? 0} จุดต้องแก้</span>`);
    right = `<div class="card primary"><h2>ดำเนินการแก้ไข</h2>
      <div class="note-box small">เมื่อยืนยันแก้ไขเสร็จ สถานะจะกลับเป็น <b>"รอตรวจ QC"</b> เพื่อตรวจรอบ ${next} และร้านจะได้รับแจ้ง</div>
      <label class="check"><input type="checkbox" id="ok"><span>แก้ไขครบทุกจุดที่ไม่ผ่าน และทดสอบซ้ำในโรงงานแล้ว</span></label>
      <button class="btn wide" id="go" disabled>${icon("send", 16)}ส่งตรวจ QC ใหม่</button></div>${limit}${history}`;
  } else {
    left = itemsCard(`ผลตรวจ QC รอบ ${last?.round_no}`, `ตรวจเมื่อ ${dateTimeTH(last?.at)} · ผ่านทุกหัวข้อ`, last?.items ?? []);
    right = `<div class="card primary"><h2>ผ่าน QC แล้ว</h2><p class="small muted">ร้านจะนัดวันติดตั้งกับลูกค้าและโรงงาน ติดตามต่อได้ที่ Installation</p></div>${history}`;
  }

  el.innerHTML = `<div class="head"><div><h1>${TITLE[0]}</h1><div class="muted">${esc(o.order_code)} · ${TITLE[1]}</div></div>
      <a class="btn ghost" href="#/qc">${icon("arrowLeft", 16)}กลับรายการ QC</a></div>
    <div class="card steps"><ol class="psteps">${STEPS.map((s, i) => `<li class="${i < done ? "done" : i === done ? "on" : ""}">
      <span class="num">${i < done ? icon("check", 14) : i + 1}</span>${s}</li>`).join("")}</ol></div>
    ${job}
    <div class="grid cols-prod" style="margin-top:18px"><div class="stack">${left}</div><div class="stack">${right}</div></div>`;

  const ok = $("#ok", el), go = $("#go", el);
  if (o.status === 5 && !review && items.length) {
    const rows = $$(".qc-item[data-i]", el);
    const read = () => rows.map((r) => ({ item_id: Number(r.dataset.i), v: $("input[type=radio]:checked", r)?.value, note: $(".fix", r).value.trim() }));
    const sync = () => {
      const res = read();
      rows.forEach((r, k) => { $(".fix", r).hidden = res[k].v !== "0"; r.classList.toggle("failed", res[k].v === "0"); });
      const pass = res.filter((x) => x.v === "1").length, fail = res.filter((x) => x.v === "0").length, left = res.length - pass - fail;
      const missing = res.some((x) => x.v === "0" && !x.note);
      $("#sum", el).innerHTML = left ? `ผ่าน ${pass} · ไม่ผ่าน ${fail} · <b>ยังไม่ตรวจ ${left} หัวข้อ</b>`
        : fail ? `ไม่ผ่าน ${fail} หัวข้อ → ส่งผลให้ร้านตรวจ ร้านจะส่งกลับให้แก้ไข${missing ? `<div class="red">ระบุจุดที่ต้องแก้ให้ครบทุกหัวข้อที่ไม่ผ่าน</div>` : ""}`
        : `ผ่านทุกหัวข้อ → ส่งผลให้ร้านตรวจ แล้วร้านจะยืนยันผ่าน QC`;
      go.disabled = !(ok.checked && !left && !missing);
      go.className = "btn wide" + (fail && !left ? " red" : "");
    };
    el.addEventListener("input", sync); el.addEventListener("change", sync); sync();
    go.onclick = async () => {
      go.disabled = true;
      try {
        await rpc("staff_qc_submit", { p_order: o.order_id, p_stage: "production",
          p_results: read().map((x) => ({ item_id: x.item_id, passed: x.v === "1", note: x.v === "0" ? x.note : null })) });
        toast("บันทึกผล QC แล้ว ส่งให้ร้านตรวจ");
        refreshShell(); navigate();
      } catch (e) { toast(errText(e), true); go.disabled = false; }
    };
  } else if (o.status === 6) {
    ok.onchange = () => { go.disabled = !ok.checked; };
    go.onclick = async () => {
      go.disabled = true;
      try { await rpc("staff_rework_done", { p_order: o.order_id }, `ส่งตรวจ QC รอบ ${next} แล้ว`); refreshShell(); navigate(); }
      catch (e) { toast(errText(e), true); go.disabled = false; }
    };
  }
});
