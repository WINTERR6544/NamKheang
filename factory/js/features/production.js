// Sidebar: Production (งานผลิตของโรงงาน). Active jobs only (fetchProduction): waiting to start (3) and in production (4).
// Marking a job finished moves it to 5 waiting_qc, so it leaves this list for QC / Rework.
// Jobs due by tomorrow are flagged, the same rule as the nightly reminder to the factory.
route(/^\/production$/, async (el) => {
  const jobs = await fetchProduction();
  const count = (s) => jobs.filter((j) => j.stage === s).length;
  const due = jobs.filter(dueSoon);
  const TABS = [["all", "ทั้งหมด", jobs.length], ["ready", "รอเริ่มผลิต", count("ready")], ["making", "กำลังผลิต", count("making")]];
  const PER = 10;
  let tab = TABS.some(([k]) => k === hashParams().get("tab")) ? hashParams().get("tab") : "all", page = 1;

  const metric = (ic, cls, label, n, sub) => `<div class="metric"><span class="tile ${cls}">${icon(ic, 20)}</span>
    <div><div class="small muted">${label}</div><div class="n">${n}</div><div class="small muted">${sub}</div></div></div>`;
  el.innerHTML = `<div class="head"><div><h1>งานผลิตของโรงงาน</h1><div class="muted">งานที่รอเริ่มผลิตและกำลังผลิต เมื่อผลิตเสร็จ งานจะย้ายไปที่ QC / Rework</div></div></div>
    ${due.length ? `<div class="banner warn">${icon("alert", 20)}<div><b>มี ${due.length} งานใกล้ถึงหรือเลยวันที่คาดว่าจะเสร็จ</b>
      <div class="small">${due.map((j) => esc(j.o.order_code)).join(", ")} · อัปเดตวันที่คาดว่าจะเสร็จ หรือยืนยันผลิตเสร็จสิ้น</div></div></div>` : ""}
    <div class="metrics">
      ${metric("clipboard", "", "งานผลิตทั้งหมด", jobs.length, "รอเริ่ม + กำลังผลิต")}
      ${metric("play", "warm", "รอเริ่มผลิต", count("ready"), "รับผลิตแล้ว ยังไม่เริ่ม")}
      ${metric("factory", "", "กำลังผลิต", count("making"), "อยู่ในสายการผลิต")}
      ${metric("clock", due.length ? "bad" : "", "ใกล้ครบกำหนด", due.length, "ครบกำหนดภายในพรุ่งนี้")}
    </div>
    <div class="tabs" role="tablist">${TABS.map(([k, l, n]) => `<button role="tab" data-tab="${k}">${l} ${n}</button>`).join("")}</div>
    <div class="toolbar">
      <label class="search">${icon("search")}<input id="q" placeholder="ค้นหา Order No., รุ่นเครื่อง หรือลูกค้า" aria-label="ค้นหา"></label>
      <label class="selbtn">${icon("sort", 16)}<span>เรียง:</span><select id="so" aria-label="เรียงลำดับ">
        <option value="new">รับผลิตล่าสุดก่อน</option><option value="due">ใกล้วันเสร็จก่อน</option><option value="old">รับผลิตเก่าสุดก่อน</option></select></label>
    </div>
    <div class="card flush"><div id="tb"></div></div>
    <p class="hint"><b>ขั้นตอนการผลิต</b> รับงานแล้ว → เริ่มผลิตและกำหนดวันเสร็จ → อัปเดตความคืบหน้า → ผลิตเสร็จสิ้น ส่งตรวจ QC</p>`;

  const act = { ready: `${icon("play", 14)}เริ่มผลิต`, making: `${icon("arrowUpRight", 16)}ผลิตเสร็จ / เลื่อนวัน` };
  const row = (j) => `<tr class="click" data-href="#/production/${j.o.order_id}">
      <td><b class="mono">${esc(j.o.order_code)}</b><div class="small muted">${esc(j.o.customers?.name ?? "-")}</div></td>
      <td><b>${esc(modelName(j.o))}</b><div class="small muted">${esc(j.o.machine_type)} · ${esc(j.o.capacity)}</div></td>
      <td>${stagePill(j)}${dueText(j) ? `<div class="small muted">${dueText(j)}</div>` : ""}</td>
      <td>${j.o.started_at ? dateTH(j.o.started_at) : "-"}</td>
      <td>${j.o.est_finish_date ? dateTH(j.o.est_finish_date) : "-"}</td>
      <td><div class="acts"><a class="btn ghost eval" href="#/production/${j.o.order_id}">${act[j.stage]}</a></div></td>
    </tr>`;
  const draw = () => {
    const q = $("#q").value.trim().toLowerCase(), so = $("#so").value;
    const rows = jobs.filter((j) => (tab === "all" || j.stage === tab) &&
      (!q || [j.o.order_code, modelName(j.o), j.o.machine_type, j.o.customers?.name].some((x) => String(x ?? "").toLowerCase().includes(q))));
    if (so === "old") rows.reverse();
    if (so === "due") rows.sort((a, b) => (a.o.est_finish_date ?? "9999") < (b.o.est_finish_date ?? "9999") ? -1 : 1);
    const pages = Math.max(1, Math.ceil(rows.length / PER));
    page = Math.min(page, pages);
    const shown = rows.slice((page - 1) * PER, page * PER);
    $$(".tabs button", el).forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
    $("#tb").innerHTML = !rows.length ? `<div class="empty">${jobs.length ? "ไม่พบงานที่ตรงกับเงื่อนไข" : "ไม่มีงานที่รอเริ่มผลิตหรือกำลังผลิต รับผลิตได้จากหน้า Manufacturing Requests"}</div>` :
      `<div class="tw"><table class="t req"><thead><tr><th>Order No. / ลูกค้า</th><th>รุ่นเครื่อง</th><th>สถานะ</th><th>วันเริ่มผลิต</th><th>เสร็จโดยประมาณ</th><th>ดำเนินการ</th></tr></thead>
        <tbody>${shown.map(row).join("")}</tbody></table></div>
       <div class="pager"><span class="small muted">แสดง ${(page - 1) * PER + 1}–${(page - 1) * PER + shown.length} จาก ${rows.length} รายการ</span>
        <div class="pages"><button class="pg" data-pg="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="หน้าก่อน">${icon("chevronLeft", 16)}</button>
        ${Array.from({ length: pages }, (_, i) => `<button class="pg ${i + 1 === page ? "on" : ""}" data-pg="${i + 1}">${i + 1}</button>`).join("")}
        <button class="pg" data-pg="${page + 1}" ${page === pages ? "disabled" : ""} aria-label="หน้าถัดไป">${icon("chevronRight", 16)}</button></div></div>`;
  };
  const reset = () => { page = 1; draw(); };
  $("#q").oninput = reset; $("#so").onchange = reset;
  el.onclick = (e) => {
    const t = e.target.closest("[data-tab]"), p = e.target.closest("[data-pg]"), tr = e.target.closest("tr[data-href]");
    if (t) { tab = t.dataset.tab; history.replaceState(null, "", `#/production${tab === "all" ? "" : "?tab=" + tab}`); reset(); }
    else if (p && !p.disabled) { page = Number(p.dataset.pg); draw(); }
    else if (tr && !e.target.closest("a, button")) location.hash = tr.dataset.href; // the whole row opens the job
  };
  draw();
});
