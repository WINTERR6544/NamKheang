// Sidebar: QC / Rework (ภาพรวมการตรวจ QC). Orders of this factory in QC: waiting (5), failed and being fixed (6), passed (7).
// One row per order with its latest round. A passed order leaves the list once the shop books the install (8).
route(/^\/qc$/, async (el) => {
  const [jobs, maxRounds] = await Promise.all([fetchQcJobs(), qcMaxRounds()]);
  const rounds = await fetchQcRounds(jobs.map((j) => j.o.order_id));
  jobs.forEach((j) => { j.rounds = rounds.get(j.o.order_id) ?? []; j.qc = qcState(j, j.rounds); });
  const count = (...s) => jobs.filter((j) => s.includes(j.qc)).length;
  const TABS = [["all", "ทั้งหมด", jobs.length], ["todo", "รอตรวจ", count("pending", "recheck")], ["fail", "ไม่ผ่าน", count("fail")], ["pass", "ผ่าน", count("pass")]];
  const inTab = (j, t) => t === "all" || (t === "todo" ? ["pending", "recheck"].includes(j.qc) : j.qc === t);
  const PER = 10;
  let tab = TABS.some(([k]) => k === hashParams().get("tab")) ? hashParams().get("tab") : "all", page = 1;

  const metric = (ic, cls, label, n, sub) => `<div class="metric"><span class="tile ${cls}">${icon(ic, 20)}</span>
    <div><div class="small muted">${label}</div><div class="n">${n}</div><div class="small muted">${sub}</div></div></div>`;
  el.innerHTML = `<div class="head"><div><h1>ภาพรวมการตรวจ QC</h1><div class="muted">ตรวจ QC งานที่ผลิตเสร็จ บันทึกผลทุกหัวข้อ และแก้ไขงานที่ไม่ผ่านก่อนส่งตรวจใหม่</div></div></div>
    <div class="metrics">
      ${metric("clock", "warm", "รอตรวจ", count("pending"), "ผลิตเสร็จ ยังไม่มีผลตรวจ")}
      ${metric("circleCheck", "", "ผ่าน", count("pass"), "รอร้านนัดวันติดตั้ง")}
      ${metric("x", "bad", "ไม่ผ่าน", count("fail"), "ต้องแก้ไขก่อนส่งตรวจใหม่")}
      ${metric("arrowUpRight", "", "ส่งตรวจซ้ำ", count("recheck"), "แก้ไขแล้ว รอตรวจรอบถัดไป")}
    </div>
    <div class="tabs" role="tablist">${TABS.map(([k, l, n]) => `<button role="tab" data-tab="${k}">${l} ${n}</button>`).join("")}</div>
    <div class="toolbar">
      <label class="search">${icon("search")}<input id="q" placeholder="ค้นหา Order No., ลูกค้า หรือรุ่นเครื่อง" aria-label="ค้นหา"></label>
      <label class="selbtn">${icon("sort", 16)}<span>เรียง:</span><select id="so" aria-label="เรียงลำดับ">
        <option value="todo">งานที่ต้องดำเนินการก่อน</option><option value="new">ล่าสุดก่อน</option></select></label>
    </div>
    <div class="banner">${icon("info", 20)}<div class="small">แสดงผล QC รอบล่าสุดของแต่ละคำสั่งซื้อ · ไม่ผ่านได้สูงสุด ${maxRounds} รอบ ก่อนร้านพิจารณาเปลี่ยนโรงงาน</div></div>
    <div class="card flush"><div id="tb"></div></div>`;

  const ORDER = { fail: 0, pending: 1, recheck: 1, pass: 2 };
  const roundCell = (j) => {
    const last = j.rounds[0];
    return j.o.status === 5 ? `รอบ ${(last?.round_no ?? 0) + 1}<div class="small muted">รอตรวจ</div>` : `รอบ ${last?.round_no ?? "-"}<div class="small muted">ผลล่าสุด</div>`;
  };
  const sub = (j) => {
    const last = j.rounds[0];
    if (j.qc === "fail") return `ไม่ผ่าน ${last?.failed.length ?? 0} ข้อ`;
    if (j.qc === "pass") return "พร้อมนัดวันติดตั้ง";
    if (j.qc === "recheck") return `แก้ไขจากรอบ ${last.round_no} แล้ว`;
    return `ผลิตเสร็จ ${dateTH(j.o.finished_at)}`;
  };
  const act = { pending: `${icon("arrowUpRight", 16)}ตรวจ QC`, recheck: `${icon("arrowUpRight", 16)}ตรวจ QC`, fail: `${icon("arrowUpRight", 16)}แก้ไขงาน`, pass: "ดูผล QC" };
  const row = (j) => `<tr class="click" data-href="#/qc/${j.o.order_id}">
      <td><b class="mono">${esc(j.o.order_code)}</b><div class="small muted">ผลิตเสร็จ ${dateTH(j.o.finished_at)}</div></td>
      <td>${esc(j.o.customers?.name ?? "-")}</td>
      <td><b>${esc(modelName(j.o))}</b><div class="small muted">${esc(j.o.capacity)}</div></td>
      <td>${roundCell(j)}</td>
      <td>${qcPill(j.qc)}<div class="small muted">${sub(j)}</div></td>
      <td>${j.rounds[0] && j.o.status !== 5 ? dateTH(j.rounds[0].at) : `<span class="muted">—</span>`}</td>
      <td><div class="acts"><a class="btn ghost eval" href="#/qc/${j.o.order_id}">${act[j.qc]}</a></div></td>
    </tr>`;
  const draw = () => {
    const q = $("#q").value.trim().toLowerCase(), so = $("#so").value;
    const rows = jobs.filter((j) => inTab(j, tab) &&
      (!q || [j.o.order_code, modelName(j.o), j.o.customers?.name].some((x) => String(x ?? "").toLowerCase().includes(q))));
    if (so === "todo") rows.sort((a, b) => ORDER[a.qc] - ORDER[b.qc]);
    const pages = Math.max(1, Math.ceil(rows.length / PER));
    page = Math.min(page, pages);
    const shown = rows.slice((page - 1) * PER, page * PER);
    $$(".tabs button", el).forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
    $("#tb").innerHTML = !rows.length ? `<div class="empty">${jobs.length ? "ไม่พบงานที่ตรงกับเงื่อนไข" : "ยังไม่มีงานที่รอตรวจ QC งานจะเข้ามาเมื่อยืนยันผลิตเสร็จในหน้า Production"}</div>` :
      `<div class="tw"><table class="t req"><thead><tr><th>Order No.</th><th>ลูกค้า</th><th>รุ่นเครื่อง</th><th>QC Round</th><th>สถานะ QC</th><th>วันที่ตรวจ</th><th>ดำเนินการ</th></tr></thead>
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
    if (t) { tab = t.dataset.tab; history.replaceState(null, "", `#/qc${tab === "all" ? "" : "?tab=" + tab}`); reset(); }
    else if (p && !p.disabled) { page = Number(p.dataset.pg); draw(); }
    else if (tr && !e.target.closest("a, button")) location.hash = tr.dataset.href;
  };
  draw();
});
