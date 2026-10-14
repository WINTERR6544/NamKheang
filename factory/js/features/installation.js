// Sidebar: Installation (ตารางนัดติดตั้ง). Orders of this factory after QC: booked (8, an install or a fix visit), waiting for the
// shop to book a date (7), installed and waiting for the customer (9). The shop books and moves dates; the factory confirms the install.
route(/^\/installation$/, async (el) => {
  const jobs = await fetchInstallJobs();
  const { appts, probs } = await fetchInstallExtras(jobs.map((j) => j.o.order_id));
  jobs.forEach((j) => {
    j.appts = appts.get(j.o.order_id) ?? [];
    j.appt = j.appts.find((a) => a.status === "scheduled") ?? null;
    j.prob = openProblem(j, probs.get(j.o.order_id));
    j.st = instState(j, j.appt, probs.get(j.o.order_id));
  });
  const TABS = [["booked", "นัดยืนยันแล้ว", (j) => j.o.status === 8], ["waiting", "รอประสานนัด", (j) => j.o.status === 7], ["done", "ติดตั้งเสร็จ", (j) => j.o.status === 9]];
  const n = (k) => jobs.filter(TABS.find((t) => t[0] === k)[2]).length;
  const months = [...new Map(jobs.filter((j) => j.appt).map((j) => [monthKey(j.appt.install_datetime), monthTH(j.appt.install_datetime)])).entries()];
  const PER = 10;
  let tab = TABS.some(([k]) => k === hashParams().get("tab")) ? hashParams().get("tab") : "booked", page = 1;
  const today = todayISO();
  const dueToday = jobs.filter((j) => j.o.status === 8 && j.appt && isoOf(j.appt.install_datetime) <= today);

  const metric = (ic, cls, label, num, sub) => `<div class="metric"><span class="tile ${cls}">${icon(ic, 20)}</span>
    <div><div class="small muted">${label}</div><div class="n">${num}</div><div class="small muted">${sub}</div></div></div>`;
  el.innerHTML = `<div class="head"><div><h1>ตารางนัดติดตั้ง</h1><div class="muted">วันนัดที่ร้านประสานกับลูกค้าแล้ว ติดตั้งและทดสอบตามนัด แล้วยืนยันติดตั้งเสร็จ</div></div></div>
    ${dueToday.length ? `<div class="banner warn">${icon("alert", 20)}<div><b>มี ${dueToday.length} งานถึงวันนัดแล้ว</b>
      <div class="small">${dueToday.map((j) => esc(j.o.order_code)).join(", ")} · ติดตั้งและทดสอบเสร็จแล้วให้ยืนยันติดตั้งเสร็จ</div></div></div>` : ""}
    <div class="metrics three">
      ${metric("calendar", "", "นัดที่ยืนยันแล้ว", n("booked"), "ร้านบันทึกวันนัดแล้ว")}
      ${metric("clock", "warm", "รอประสานวันนัด", n("waiting"), "ผ่าน QC รอร้านนัดวัน")}
      ${metric("circleCheck", "", "ติดตั้งเสร็จ", n("done"), "รอลูกค้าตรวจรับ")}
    </div>
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}">${l} ${n(k)}</button>`).join("")}</div>
    <div class="toolbar">
      <label class="search">${icon("search")}<input id="q" placeholder="ค้นหา Order No., ลูกค้า หรือสถานที่ติดตั้ง" aria-label="ค้นหา"></label>
      <label class="selbtn">${icon("calendar", 16)}<span>วันนัด:</span><select id="mo" aria-label="เดือนที่นัด"><option value="">ทุกเดือน</option>${months.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></label>
      <label class="selbtn">${icon("sort", 16)}<span>เรียง:</span><select id="so" aria-label="เรียงลำดับ"><option value="near">วันนัดใกล้สุด</option><option value="far">วันนัดไกลสุด</option></select></label>
    </div>
    <div class="card flush"><div class="card-h"><h2 id="tt"></h2></div><div id="tb"></div></div>`;

  const TITLE = { booked: "นัดติดตั้งที่ร้านยืนยัน", waiting: "งานที่ผ่าน QC รอร้านประสานวันนัด", done: "ติดตั้งเสร็จ รอลูกค้าตรวจรับ" };
  const sub = (j) => j.st === "fix" ? "นัดเข้าแก้ไขปัญหาที่ลูกค้าแจ้ง" : j.st === "reported" ? "ร้านจะนัดวันเข้าแก้ไข"
    : j.o.status === 9 ? `ติดตั้งเสร็จ ${dateTH(j.o.installed_at)}` : j.appt?.reschedule_count ? `เลื่อนนัด ${j.appt.reschedule_count} ครั้ง` : j.o.status === 7 ? "ผ่าน QC พร้อมส่งมอบ" : "";
  const canConfirm = (j) => j.o.status === 8 && j.appt && isoOf(j.appt.install_datetime) <= today;
  const row = (j) => `<tr class="click" data-href="#/installation/${j.o.order_id}">
      <td>${j.appt ? `<b>${dateTH(j.appt.install_datetime)}</b><div class="small muted">${timeOnly(j.appt.install_datetime)}</div>` : `<span class="muted">ยังไม่มีวันนัด</span>`}</td>
      <td><b class="mono">${esc(j.o.order_code)}</b><div class="small teal">QC ผ่าน · พร้อมส่งมอบ</div></td>
      <td>${esc(j.o.customers?.name ?? "-")}<div class="small muted clip">${esc(j.o.install_address ?? "")}</div></td>
      <td><b>${esc(modelName(j.o))}</b><div class="small muted">${esc(j.o.capacity)}</div></td>
      <td>${instPill(j.st)}${sub(j) ? `<div class="small muted">${sub(j)}</div>` : ""}</td>
      <td><div class="acts">${canConfirm(j) ? `<a class="btn ghost eval" href="#/installation/${j.o.order_id}">${icon("check", 16)}ยืนยันติดตั้งเสร็จ</a>`
        : `<a class="btn ghost" href="#/installation/${j.o.order_id}">${icon("arrowUpRight", 16)}ดูรายละเอียด</a>`}</div></td>
    </tr>`;
  const draw = () => {
    const q = $("#q").value.trim().toLowerCase(), mo = $("#mo").value, so = $("#so").value;
    const inTab = TABS.find((t) => t[0] === tab)[2];
    const rows = jobs.filter((j) => inTab(j) && (!mo || (j.appt && monthKey(j.appt.install_datetime) === mo)) &&
      (!q || [j.o.order_code, j.o.customers?.name, j.o.install_address, modelName(j.o)].some((x) => String(x ?? "").toLowerCase().includes(q))));
    const key = (j) => j.appt?.install_datetime ?? "9999";
    rows.sort((a, b) => (key(a) < key(b) ? -1 : 1) * (so === "far" ? -1 : 1));
    const pages = Math.max(1, Math.ceil(rows.length / PER));
    page = Math.min(page, pages);
    const shown = rows.slice((page - 1) * PER, page * PER);
    $$(".tabs button", el).forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
    $("#tt").textContent = TITLE[tab];
    $("#tb").innerHTML = !rows.length ? `<div class="empty">ไม่มีงานในหมวดนี้</div>` :
      `<div class="tw"><table class="t req"><thead><tr><th>วัน / เวลา</th><th>Order No.</th><th>ลูกค้า / สถานที่</th><th>รุ่นเครื่อง</th><th>สถานะ</th><th>ดำเนินการ</th></tr></thead>
        <tbody>${shown.map(row).join("")}</tbody></table></div>
       <div class="pager"><span class="small muted">แสดง ${(page - 1) * PER + 1}–${(page - 1) * PER + shown.length} จาก ${rows.length} รายการ</span>
        <div class="pages"><button class="pg" data-pg="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="หน้าก่อน">${icon("chevronLeft", 16)}</button>
        ${Array.from({ length: pages }, (_, i) => `<button class="pg ${i + 1 === page ? "on" : ""}" data-pg="${i + 1}">${i + 1}</button>`).join("")}
        <button class="pg" data-pg="${page + 1}" ${page === pages ? "disabled" : ""} aria-label="หน้าถัดไป">${icon("chevronRight", 16)}</button></div></div>`;
  };
  const reset = () => { page = 1; draw(); };
  $("#q").oninput = reset; $("#mo").onchange = reset; $("#so").onchange = reset;
  el.onclick = (e) => {
    const t = e.target.closest("[data-tab]"), p = e.target.closest("[data-pg]"), tr = e.target.closest("tr[data-href]");
    if (t) { tab = t.dataset.tab; history.replaceState(null, "", `#/installation?tab=${tab}`); reset(); }
    else if (p && !p.disabled) { page = Number(p.dataset.pg); draw(); }
    else if (tr && !e.target.closest("a, button")) location.hash = tr.dataset.href;
  };
  draw();
});
