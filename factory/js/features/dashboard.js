// Sidebar: Dashboard (ภาพรวมโรงงาน). One read-only summary of the other pages, from the same queries:
//   cards       - new requests, in production, rework, installs booked
//   to do       - every job waiting on the factory, most urgent first, each with a link to the page that does it
route(/^\/dashboard$/, async (el) => {
  const [reqs, prod, qcJobs, inst] = await Promise.all([fetchRequests(), fetchProduction(), fetchQcJobs(), fetchInstallJobs()]);
  const [rounds, extras] = await Promise.all([fetchQcRounds(qcJobs.map((j) => j.o.order_id)), fetchInstallExtras(inst.map((j) => j.o.order_id))]);
  const today = todayISO();
  const pending = reqs.filter((r) => r.state === "pending").sort((a, b) => (a.sent_at < b.sent_at ? -1 : 1));
  const ready = prod.filter((j) => j.stage === "ready"), making = prod.filter((j) => j.stage === "making");
  qcJobs.forEach((j) => { j.qc = qcState(j, rounds.get(j.o.order_id) ?? []); });
  inst.forEach((j) => {
    j.appt = (extras.appts.get(j.o.order_id) ?? []).find((a) => a.status === "scheduled") ?? null;
    j.st = instState(j, j.appt, extras.probs.get(j.o.order_id));
  });
  const rework = qcJobs.filter((j) => j.qc === "fail"), toCheck = qcJobs.filter((j) => j.qc === "pending" || j.qc === "recheck");
  const booked = inst.filter((j) => j.o.status === 8), dueInstall = booked.filter((j) => j.appt && isoOf(j.appt.install_datetime) <= today);
  const who = (o) => `${esc(o.customers?.name ?? "-")} · ${esc(modelName(o))}`;

  // most urgent first: fix QC findings, installs due, overdue production, requests to answer, QC to record, production to start
  const todo = [
    ...rework.map((j) => ({ ic: "x", title: `แก้ไขงานจากผล QC ${modelName(j.o)}`, sub: who(j.o), pill: ["ไม่ผ่าน QC", "bad"], code: j.o.order_code, href: `#/qc/${j.o.order_id}`, act: "แก้ไขงาน" })),
    ...dueInstall.map((j) => ({ ic: "wrench", title: `${j.st === "fix" ? "เข้าแก้ไขและยืนยัน" : "ติดตั้งและยืนยัน"} ${modelName(j.o)}`, sub: `${who(j.o)} · นัด ${dateTH(j.appt.install_datetime)}`,
      pill: [j.st === "fix" ? "นัดเข้าแก้ไข" : "ถึงวันนัด", j.st === "fix" ? "bad" : "warn"], code: j.o.order_code, href: `#/installation/${j.o.order_id}`, act: "ยืนยันติดตั้ง" })),
    ...making.filter(dueSoon).map((j) => ({ ic: "clock", title: `ติดตามการผลิต ${modelName(j.o)}`, sub: `${who(j.o)} · เสร็จโดยประมาณ ${dateTH(j.o.est_finish_date)}`,
      pill: [daysUntil(j.o.est_finish_date) < 0 || badPlan(j.o) ? "เลยกำหนด" : "ใกล้ครบกำหนด", daysUntil(j.o.est_finish_date) < 0 || badPlan(j.o) ? "bad" : "warn"],
      code: j.o.order_code, href: `#/production/${j.o.order_id}`, act: "ดูการผลิต" })),
    ...pending.map((r) => ({ ic: "clipboard", title: `ประเมินคำขอผลิต ${modelName(r.orders)}`, sub: `${esc(r.orders.customers?.name ?? "-")} · ส่งมา ${dateTH(r.sent_at)}`,
      pill: ["งานใหม่", ""], code: r.orders.order_code, href: `#/requests/${r.orders.order_id}/evaluate`, act: "ประเมินงาน" })),
    ...toCheck.map((j) => ({ ic: "circleCheck", title: `ตรวจ QC ${modelName(j.o)}`, sub: `${who(j.o)} · ผลิตเสร็จ ${dateTH(j.o.finished_at)}`,
      pill: [j.qc === "recheck" ? "ตรวจซ้ำ" : "รอตรวจ QC", "warn"], code: j.o.order_code, href: `#/qc/${j.o.order_id}`, act: "ตรวจ QC" })),
    ...ready.map((j) => ({ ic: "play", title: `เริ่มผลิต ${modelName(j.o)}`, sub: `${who(j.o)} · รับผลิตเมื่อ ${dateTH(j.responded_at)}`,
      pill: ["รอเริ่มผลิต", "warn"], code: j.o.order_code, href: `#/production/${j.o.order_id}`, act: "เริ่มผลิต" })),
  ];
  const SHOW = 6;

  const card = (href, ic, label, n, sub, cls = "") => `<a class="metric link" href="${href}"><div class="grow"><div class="small muted">${label}</div>
      <div class="n">${n}</div><div class="small ${cls}">${sub}</div></div><span class="ic-r ${cls}">${icon(ic, 20)}</span></a>`;
  const hello = new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  el.innerHTML = `<div class="head"><div><h1>ภาพรวมโรงงาน</h1>
      <div class="muted">สวัสดีคุณ ${esc(ME.name)} วันนี้มี ${todo.length} งานที่ต้องดำเนินการ · ${hello}</div></div>
      <a class="btn" href="#/requests?tab=pending">${icon("clipboard", 16)}ดูคำขอผลิตใหม่</a></div>
    <div class="metrics">
      ${card("#/requests?tab=pending", "clipboard", "งานใหม่", pending.length, "รอประเมินจากร้าน")}
      ${card("#/production", "factory", "กำลังผลิต", making.length, `${ready.length} งานรอเริ่มผลิต`)}
      ${card("#/qc?tab=fail", "x", "Rework", rework.length, "รอแก้ไขจากผล QC", rework.length ? "red" : "")}
      ${card("#/installation", "wrench", "งานติดตั้ง", booked.length, "นัดยืนยันแล้ว")}
    </div>
    <div class="card"><div class="row-sb"><h2>งานที่ต้องดำเนินการ</h2><span class="pill dot mute">${todo.length} งาน</span></div>
        <div class="muted small">เรียงตามความเร่งด่วน</div>
        ${todo.length ? `<ul class="todo">${todo.slice(0, SHOW).map((t) => `<li>
          <span class="tile">${icon(t.ic, 18)}</span>
          <div class="grow"><div class="row-sb"><b>${esc(t.title)}</b><span class="pill dot ${t.pill[1]}">${t.pill[0]}</span></div>
            <div class="small muted">${t.sub}</div>
            <div class="row-sb small"><span class="muted mono">${esc(t.code)}</span><a class="teal lnk" href="${t.href}">${icon("arrowUpRight", 14)}${t.act}</a></div></div></li>`).join("")}</ul>
          ${todo.length > SHOW ? `<p class="small muted">และอีก ${todo.length - SHOW} งาน · ดูได้ในแต่ละเมนู</p>` : ""}`
        : `<div class="empty">ไม่มีงานค้าง</div>`}</div>`;
});
