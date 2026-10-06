// Sidebar: Manufacturing Requests (คำขอผลิตจากร้าน). Requests the shop sent to this factory, with tabs, search, month filter and paging.
route(/^\/requests$/, async (el) => {
  const all = await fetchRequests();
  const reqs = all.filter((r) => r.state !== "accepted"); // accepted requests continue on the Production page
  const count = (s) => reqs.filter((r) => r.state === s).length;
  const TABS = [["all", "ทั้งหมด", reqs.length], ["pending", "รอประเมิน", count("pending")], ["rejected", "ปฏิเสธแล้ว", count("rejected")]];
  const months = [...new Map(reqs.map((r) => [monthKey(r.sent_at), monthTH(r.sent_at)])).entries()];
  const PER = 10;
  let tab = TABS.some(([k]) => k === hashParams().get("tab")) ? hashParams().get("tab") : "all", page = 1;

  const pending = count("pending");
  el.innerHTML = `<div class="head"><div><h1>คำขอผลิตจากร้าน</h1><div class="muted">ตรวจสอบรายละเอียดและประเมินงานก่อนรับเข้าสู่แผนการผลิต</div></div></div>
    ${pending ? `<div class="banner">${icon("info", 20)}<div><b>มี ${pending} คำขอใหม่รอการประเมิน</b>
      <div class="small muted">ตรวจสอบสเปกเครื่อง สถานที่ติดตั้ง และกำลังผลิตของโรงงาน ก่อนยืนยันรับผลิตหรือปฏิเสธงาน</div></div></div>` : ""}
    <div class="tabs" role="tablist">${TABS.map(([k, l, n]) => `<button role="tab" data-tab="${k}">${l} ${n}</button>`).join("")}</div>
    <div class="toolbar">
      <label class="search">${icon("search")}<input id="q" placeholder="ค้นหา Order No., รุ่นเครื่อง หรือลูกค้า" aria-label="ค้นหา"></label>
      <label class="selbtn">${icon("calendar", 16)}<span>วันที่ส่ง:</span><select id="mo" aria-label="วันที่ส่ง"><option value="">ทุกเดือน</option>${months.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></label>
      <label class="selbtn">${icon("sort", 16)}<span>เรียง:</span><select id="so" aria-label="เรียงลำดับ"><option value="new">ล่าสุดก่อน</option><option value="old">เก่าสุดก่อน</option></select></label>
    </div>
    <div class="card flush"><div id="tb"></div></div>
    <p class="hint"><b>ขั้นตอนประเมินคำขอ</b> ดูรายละเอียด → ตรวจสอบสเปกและกำลังผลิต → รับผลิต / ปฏิเสธ → ยืนยันส่งผลให้ร้าน</p>`;

  const row = (r) => {
    const o = r.orders;
    return `<tr>
      <td><b class="mono">${esc(o.order_code)}</b><div class="small muted">${esc(o.customers?.name ?? "-")}</div></td>
      <td><b>${esc(modelName(o))}</b><div class="small muted">${esc(o.machine_type)} · ${esc(o.capacity)}</div></td>
      <td>${dateTH(r.sent_at)}</td>
      <td>${statePill(r.state)}</td>
      <td><div class="acts"><a class="btn ghost" href="#/requests/${o.order_id}">ดูรายละเอียด</a>${r.state === "pending" ? `<a class="btn ghost eval" href="#/requests/${o.order_id}/evaluate">${icon("arrowUpRight", 16)}ประเมินงาน</a>` : ""}</div></td>
    </tr>`;
  };
  const draw = () => {
    const q = $("#q").value.trim().toLowerCase(), mo = $("#mo").value, so = $("#so").value;
    const rows = reqs.filter((r) => (tab === "all" || r.state === tab) && (!mo || monthKey(r.sent_at) === mo) &&
      (!q || [r.orders.order_code, modelName(r.orders), r.orders.machine_type, r.orders.customers?.name].some((x) => String(x ?? "").toLowerCase().includes(q))));
    if (so === "old") rows.reverse();
    const pages = Math.max(1, Math.ceil(rows.length / PER));
    page = Math.min(page, pages);
    const shown = rows.slice((page - 1) * PER, page * PER);
    $$(".tabs button", el).forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
    $("#tb").innerHTML = !rows.length ? `<div class="empty">${reqs.length ? "ไม่พบคำขอที่ตรงกับเงื่อนไข" : "ยังไม่มีคำขอผลิตจากร้าน"}</div>` :
      `<div class="tw"><table class="t req"><thead><tr><th>Order No. / ลูกค้า</th><th>รุ่นเครื่อง</th><th>วันที่ส่ง</th><th>สถานะ</th><th>ดำเนินการ</th></tr></thead>
        <tbody>${shown.map(row).join("")}</tbody></table></div>
       <div class="pager"><span class="small muted">แสดง ${(page - 1) * PER + 1}–${(page - 1) * PER + shown.length} จาก ${rows.length} รายการ</span>
        <div class="pages"><button class="pg" data-pg="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="หน้าก่อน">${icon("chevronLeft", 16)}</button>
        ${Array.from({ length: pages }, (_, i) => `<button class="pg ${i + 1 === page ? "on" : ""}" data-pg="${i + 1}">${i + 1}</button>`).join("")}
        <button class="pg" data-pg="${page + 1}" ${page === pages ? "disabled" : ""} aria-label="หน้าถัดไป">${icon("chevronRight", 16)}</button></div></div>`;
  };
  const reset = () => { page = 1; draw(); };
  $("#q").oninput = reset; $("#mo").onchange = reset; $("#so").onchange = reset;
  el.onclick = (e) => {
    const t = e.target.closest("[data-tab]"), p = e.target.closest("[data-pg]");
    if (t) { tab = t.dataset.tab; history.replaceState(null, "", `#/requests${tab === "all" ? "" : "?tab=" + tab}`); reset(); }
    else if (p && !p.disabled) { page = Number(p.dataset.pg); draw(); }
  };
  draw();
});
