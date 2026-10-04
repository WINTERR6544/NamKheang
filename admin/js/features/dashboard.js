// Sidebar: Dashboard
route(/^\/dashboard$/, async (el) => {
  const [orders, pays, pend, quotes, aps, rules] = await Promise.all([
    fetchOrders(null),
    db.from("payments").select("pay_type, order_id, paid_at").eq("verified", false).then(must),
    db.from("factory_assignments").select("order_id, sent_at").eq("response", "pending").then(must),
    db.from("quotations").select("order_id, valid_until").eq("status", "sent").then(must),
    db.from("appointments").select("order_id, status").eq("status", "scheduled").then(must),
    db.from("business_rules").select("rule_key, value").then(must),
  ]);
  const rule = Object.fromEntries(rules.map((r) => [r.rule_key, Number(r.value)]));
  const by = (...s) => orders.filter((o) => s.includes(o.status));
  const cnt = (...s) => by(...s).length;
  const payN = (t) => pays.filter((p) => p.pay_type === t).length;
  const today = new Date(new Date().toDateString());
  const oMap = new Map(orders.map((o) => [o.order_id, o]));
  const scheduled = new Set(aps.map((a) => a.order_id));

  // KPI tiles follow the Figma dashboard
  const tiles = [
    ["New Order", cnt(0), "Review details", "#/orders/new", 1], ["Quotation", cnt(1), "To quote / awaiting reply", "#/orders/quotations"],
    ["Deposit", payN("deposit"), "Slips to check", "#/payments/deposit", 1], ["Factory", cnt(2) + pend.length, "Awaiting factory", "#/mfg/requests"],
    ["Production", cnt(4), "In production", "#/mfg/production"], ["QC/Rework", cnt(5, 6), cnt(6) ? `${cnt(6)} to fix` : "Awaiting QC", "#/mfg/qc", cnt(6)],
    ["Installation", cnt(7, 8), `${cnt(8)} scheduled`, "#/installation"], ["Customer Acceptance", cnt(9), "Awaiting customer", "#/installation"],
    ["Payment", payN("final"), "Final slips to check", "#/payments/final", 1], ["Completed", cnt(10), "Closed", "#/orders?status=10"],
  ];

  // task list: what the shop should do now, overdue first
  const tasks = [];
  const add = (o, title, who, href, btn, late, note) => tasks.push({ o, title, who, href, btn, late, note });
  by(0).forEach((o) => add(o, "Review new customer order", o.customers?.name, `#/order/${o.order_id}`, "Review order"));
  quotes.forEach((q) => { const o = oMap.get(q.order_id); if (o?.status === 1 && new Date(q.valid_until) < today) add(o, "Quote expired, follow up with the customer", o.customers?.name, `#/order/${o.order_id}`, "Open order", 1, `Expired ${dateTH(q.valid_until)}`); });
  pays.forEach((p) => { const o = oMap.get(p.order_id); if (!o) return;
    if (p.pay_type === "deposit") add(o, "Check deposit slip", o.customers?.name, "#/payments/deposit", "Check deposit", 0, dateTH(p.paid_at, true));
    if (p.pay_type === "final") add(o, "Check final payment and issue receipt", o.customers?.name, "#/payments/final", "Check final payment", 0, dateTH(p.paid_at, true));
    if (p.pay_type === "refund") add(o, "Transfer the deposit back to the customer", o.customers?.name, "#/payments/refund", "Refund", 0, dateTH(p.paid_at, true)); });
  by(2).forEach((o) => add(o, "Send production order to a factory", o.customers?.name, `#/order/${o.order_id}`, "Send to factory"));
  pend.forEach((a) => { const o = oMap.get(a.order_id); if (!o) return; const d = daysAgo(a.sent_at);
    add(o, "Follow up on factory reply", o.factories?.name, "#/mfg/requests", "Record reply", d > rule.factory_reply_days, d > rule.factory_reply_days ? `${Math.floor(d - rule.factory_reply_days)} days overdue` : `Sent ${dateTH(a.sent_at, true)}`); });
  by(4).forEach((o) => { if (o.est_finish_date && new Date(o.est_finish_date) < today) add(o, "Production overdue, follow up with the factory", o.factories?.name, `#/order/${o.order_id}`, "Update production", 1, `Past due ${dateTH(o.est_finish_date)}`); });
  by(5).forEach((o) => add(o, "QC the finished machine", o.factories?.name, `#/order/${o.order_id}`, "Run QC"));
  by(6).forEach((o) => add(o, "Follow up on QC fixes", o.factories?.name, `#/order/${o.order_id}`, "Follow up", 1));
  by(7).forEach((o) => add(o, "Set an install date with the customer", o.customers?.name, `#/order/${o.order_id}`, "Schedule install"));
  by(8).forEach((o) => { if (!scheduled.has(o.order_id)) add(o, "Customer asked for a new install date", o.customers?.name, `#/order/${o.order_id}`, "Schedule install", 1); });
  tasks.sort((x, y) => (y.late ? 1 : 0) - (x.late ? 1 : 0));
  const lateN = tasks.filter((x) => x.late).length;
  const stages = [["New Order", cnt(0)], ["Quotation", cnt(1)], ["Deposit", payN("deposit")], ["Factory", cnt(2) + pend.length], ["Production", cnt(4)],
    ["QC/Rework", cnt(5, 6)], ["Installation", cnt(7, 8)], ["Customer Acceptance", cnt(9)], ["Payment", payN("final")], ["Completed", cnt(10)]];
  const max = Math.max(1, ...stages.map((s) => s[1]));
  const active = orders.filter((o) => ![10, 99].includes(o.status)).length;
  const hour = new Date().getHours();

  el.innerHTML = `<div class="head"><div><h1>Hello ${esc(window.ME?.name)}</h1><div class="muted">Orders and tasks overview · ${new Date().toLocaleDateString("en-GB", { dateStyle: "full" })}</div></div></div>
    <h2>All stages at a glance</h2>
    <div class="kpis">${tiles.map(([t, n, l, h, hot]) => `<a class="kpi ${hot && n ? "hot" : ""}" href="${h}"><div class="t">${t}</div><div class="n">${n}</div><div class="l">${l}</div></a>`).join("")}</div>
    <div class="grid cols-main">
      <div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Tasks</h2>
        <span class="pill ${lateN ? "bad" : ""}">${tasks.length} tasks${lateN ? ` · ${lateN} overdue` : ""}</span></div>
        <div style="margin-top:14px">${tasks.length ? tasks.slice(0, 10).map((x) => `<div class="task ${x.late ? "late" : ""}"><div><div class="ti">${x.title}</div>
          <div class="s mono">${orderLink(x.o)} · ${esc(x.who ?? "")}${x.note ? ` · <b>${esc(x.note)}</b>` : ""}</div></div><a class="btn ghost sm" href="${x.href}">${x.btn}</a></div>`).join("") + (tasks.length > 10 ? `<div class="small muted">and ${tasks.length - 10} more</div>` : "")
          : `<div class="empty">Nothing pending 🎉</div>`}</div></div>
      <div class="card"><h2>Order pipeline</h2><div class="small muted" style="margin:-6px 0 8px">From order intake to closing</div>
        ${stages.map(([l, n]) => `<div class="bar"><span class="lab">${l}</span><span class="track"><span class="fill" style="width:${(n / max) * 100}%"></span></span><span class="v">${n}</span></div>`).join("")}
        <div class="small muted" style="margin-top:12px;border-top:1px solid var(--line);padding-top:10px">${active} in progress · ${cnt(10)} completed · ${cnt(99)} cancelled</div></div>
    </div>`;
});
