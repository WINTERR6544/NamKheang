// Sidebar: รายงาน > รายงานสรุป. Two printable reports for the shop owner, filtered by year (Buddhist era):
//   sales    ยอดขายและการรับชำระรายเดือน  quotations the customer accepted + verified payments, one row per month
//   factory  ผลการดำเนินงานของโรงงาน       production requests, replies, finished jobs, QC and lateness per factory
// The dashboard (#/dashboard) is the live overview; these pages summarise a whole year and can be printed or saved as CSV.
const RPT_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const rptYear = (s) => new Date(s).getFullYear();
const rptCsv = (name, head, rows) => {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob(["﻿" + [head, ...rows].map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

route(/^\/reports$/, async (el) => {
  const p = hashParams(), tab = p.get("tab") === "factory" ? "factory" : "sales";
  const [orders, quotes, pays, asg, facs, qcv] = await Promise.all([
    db.from("orders").select("order_id, created_at, status, factory_id, started_at, finished_at, est_finish_date").then(must),
    db.from("quotations").select("order_id, total_price, deposit_amount, status, responded_at").eq("status", "accepted").then(must),
    db.from("payments").select("order_id, amount, pay_type, verified, paid_at").eq("verified", true).then(must),
    db.from("factory_assignments").select("order_id, factory_id, response, sent_at, responded_at").then(must),
    db.from("factories").select("factory_id, name, capacity_per_month, is_active").order("name").then(must),
    db.from("qc_reviews").select("order_id, round_no, passed").then(must),
  ]);
  const years = [...new Set([new Date().getFullYear(), ...orders.map((o) => rptYear(o.created_at))])].sort((a, b) => b - a);
  const year = Number(p.get("y")) || years[0];
  const go = (t, y) => { location.hash = `#/reports?tab=${t}&y=${y}`; };

  el.innerHTML = `<div class="head"><div><h1>รายงานสรุป</h1><div class="muted">สรุปผลการดำเนินงานของร้านทั้งปี พิมพ์หรือบันทึกเป็นไฟล์ CSV ได้</div></div></div>
    <div class="row" style="justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <div class="tabs" role="tablist">${[["sales", "ยอดขายและการรับชำระ"], ["factory", "ผลการดำเนินงานของโรงงาน"]].map(([k, v]) =>
        `<button type="button" role="tab" aria-selected="${k === tab}" data-tab="${k}">${v}</button>`).join("")}</div>
      <div class="row" style="gap:8px"><label class="small muted" for="yr" style="margin:0">ปี พ.ศ.</label>
        <select id="yr" style="width:auto">${years.map((y) => `<option value="${y}" ${y === year ? "selected" : ""}>${y + 543}</option>`).join("")}</select>
        <button class="btn ghost sm" id="csv">บันทึก CSV</button><button class="btn sm" id="print">พิมพ์รายงาน</button></div>
    </div><div id="rpt"></div>`;
  $(".tabs", el).onclick = (e) => { const b = e.target.closest("[data-tab]"); if (b) go(b.dataset.tab, year); };
  $("#yr", el).onchange = (e) => go(tab, e.target.value);
  $("#print", el).onclick = () => window.print();
  const box = $("#rpt", el);
  const printed = `<div class="small muted" style="margin-top:10px">ข้อมูล ณ ${new Date().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })} · ปี พ.ศ. ${year + 543}</div>`;

  if (tab === "sales") {
    // one row per month: new orders, accepted quotations (sales), verified deposits / balances, refunds, net received
    const m = RPT_MONTHS.map(() => ({ orders: 0, cancelled: 0, won: 0, sales: 0, dep: 0, fin: 0, ref: 0 }));
    orders.filter((o) => rptYear(o.created_at) === year).forEach((o) => { const r = m[new Date(o.created_at).getMonth()]; r.orders++; if (o.status === 99) r.cancelled++; });
    const cancelledIds = new Set(orders.filter((o) => o.status === 99).map((o) => o.order_id));
    quotes.filter((q) => q.responded_at && rptYear(q.responded_at) === year && !cancelledIds.has(q.order_id)).forEach((q) => { const r = m[new Date(q.responded_at).getMonth()]; r.won++; r.sales += Number(q.total_price); });
    pays.filter((x) => rptYear(x.paid_at) === year).forEach((x) => { const r = m[new Date(x.paid_at).getMonth()];
      r[{ deposit: "dep", final: "fin", refund: "ref" }[x.pay_type]] += Number(x.amount); });
    const net = (r) => r.dep + r.fin - r.ref;
    const T = m.reduce((a, r) => { for (const k in r) a[k] += r[k]; return a; }, { orders: 0, cancelled: 0, won: 0, sales: 0, dep: 0, fin: 0, ref: 0 });
    const kpi = (t, n, l) => `<div class="kpi" style="background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:14px 16px"><div class="t">${t}</div><div class="n" style="font-size:1.5rem">${n}</div><div class="l">${l}</div></div>`;
    const head = ["เดือน", "คำสั่งซื้อใหม่", "ยกเลิก", "ใบเสนอราคาที่ตกลง", "ยอดขาย (บาท)", "รับมัดจำ (บาท)", "รับยอดคงเหลือ (บาท)", "คืนเงิน (บาท)", "รับสุทธิ (บาท)"];
    const line = (lab, r) => [lab, r.orders, r.cancelled, r.won, baht(r.sales), baht(r.dep), baht(r.fin), baht(r.ref), baht(net(r))];
    const rows = m.map((r, i) => line(RPT_MONTHS[i], r));
    box.innerHTML = `<div class="kpis">${kpi("ยอดขายทั้งปี", baht(T.sales), `ใบเสนอราคาที่ลูกค้าตกลง ${T.won} ใบ`)}${kpi("รับเงินสุทธิ", baht(net(T)), "มัดจำ + ยอดคงเหลือ − คืนเงิน")}
        ${kpi("ยอดที่ยังไม่ได้รับ", baht(Math.max(0, T.sales - T.dep - T.fin)), "ยอดขายที่ลูกค้ายังชำระไม่ครบ")}${kpi("คำสั่งซื้อใหม่", T.orders, `ยกเลิก ${T.cancelled} รายการ`)}</div>
      <div class="card"><h2 style="margin-top:0">รายงานยอดขายและการรับชำระรายเดือน ปี พ.ศ. ${year + 543}</h2>
      <div class="tw"><table class="t rpt"><thead><tr>${head.map((h, i) => `<th style="${i ? "text-align:right" : ""}">${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((v, i) => `<td style="${i ? "text-align:right" : ""}">${v}</td>`).join("")}</tr>`).join("")}</tbody>
      <tfoot><tr>${line("รวมทั้งปี", T).map((v, i) => `<th style="${i ? "text-align:right" : ""}">${v}</th>`).join("")}</tr></tfoot></table></div>
      <div class="small muted" style="margin-top:8px">ยอดขายนับจากวันที่ลูกค้าตกลงใบเสนอราคา ไม่รวมคำสั่งซื้อที่ยกเลิกภายหลัง · ยอดรับชำระนับเฉพาะสลิปที่ร้านตรวจแล้ว ตามวันที่ชำระ</div>${printed}</div>`;
    $("#csv", el).onclick = () => rptCsv(`sales-report-${year + 543}.csv`, head, [...rows, line("รวมทั้งปี", T)]);
    return;
  }

  // factory performance in the year (by the date the shop sent the request)
  const oMap = new Map(orders.map((o) => [o.order_id, o]));
  const qcByOrder = new Map(); qcv.forEach((r) => { const a = qcByOrder.get(r.order_id) ?? []; a.push(r); qcByOrder.set(r.order_id, a); });
  const days = (a, b) => (new Date(b) - new Date(a)) / 86400000;
  const rows = facs.map((f) => {
    const a = asg.filter((x) => x.factory_id === f.factory_id && rptYear(x.sent_at) === year);
    const ok = a.filter((x) => x.response === "accepted"), no = a.filter((x) => x.response === "rejected"), wait = a.filter((x) => x.response === "pending");
    const jobs = ok.map((x) => oMap.get(x.order_id)).filter(Boolean);
    const done = jobs.filter((o) => o.finished_at);
    const late = done.filter((o) => o.est_finish_date && new Date(o.finished_at) > new Date(o.est_finish_date + "T23:59:59"));
    const reviewed = done.filter((o) => qcByOrder.has(o.order_id));
    const firstPass = reviewed.filter((o) => qcByOrder.get(o.order_id).some((r) => r.round_no === 1 && r.passed));
    const reply = a.filter((x) => x.responded_at && x.response !== "pending").map((x) => days(x.sent_at, x.responded_at));
    const build = done.filter((o) => o.started_at).map((o) => days(o.started_at, o.finished_at));
    const avg = (xs) => xs.length ? (xs.reduce((s, v) => s + v, 0) / xs.length).toFixed(1) : "-";
    return { f, sent: a.length, ok: ok.length, no: no.length, wait: wait.length, inProd: jobs.filter((o) => !o.finished_at && o.status !== 99).length,
      done: done.length, late: late.length, pass: reviewed.length ? Math.round((firstPass.length / reviewed.length) * 100) + "%" : "-", reply: avg(reply), build: avg(build) };
  });
  const head = ["โรงงาน", "คำขอผลิตที่ส่ง", "ตอบรับ", "ปฏิเสธ", "รอตอบ", "กำลังผลิต", "ผลิตเสร็จ", "เสร็จเกินกำหนด", "ผ่าน QC รอบแรก", "ตอบกลับเฉลี่ย (วัน)", "ผลิตเฉลี่ย (วัน)"];
  const line = (r) => [r.f.name + (r.f.is_active ? "" : " (ปิดใช้งาน)"), r.sent, r.ok, r.no, r.wait, r.inProd, r.done, r.late, r.pass, r.reply, r.build];
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const total = ["รวมทุกโรงงาน", sum("sent"), sum("ok"), sum("no"), sum("wait"), sum("inProd"), sum("done"), sum("late"), "", "", ""];
  box.innerHTML = `<div class="card"><h2 style="margin-top:0">รายงานผลการดำเนินงานของโรงงาน ปี พ.ศ. ${year + 543}</h2>
    <div class="tw"><table class="t rpt"><thead><tr>${head.map((h, i) => `<th style="${i ? "text-align:right" : ""}">${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${line(r).map((v, i) => `<td style="${i ? "text-align:right" : ""}">${i ? v : `<b>${esc(v)}</b>`}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="11" class="empty">ยังไม่มีโรงงาน</td></tr>`}</tbody>
    <tfoot><tr>${total.map((v, i) => `<th style="${i ? "text-align:right" : ""}">${v}</th>`).join("")}</tr></tfoot></table></div>
    <div class="small muted" style="margin-top:8px">นับตามวันที่ร้านส่งคำขอผลิต · เสร็จเกินกำหนด = วันที่ผลิตเสร็จหลังวันกำหนดเสร็จที่โรงงานแจ้ง · ผ่าน QC รอบแรก คิดจากงานที่ร้านตรวจผล QC แล้ว</div>${printed}</div>`;
  $("#csv", el).onclick = () => rptCsv(`factory-report-${year + 543}.csv`, head, [...rows.map(line), total]);
});
