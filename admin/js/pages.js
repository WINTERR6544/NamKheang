// List pages: dashboard, orders, quotations, manufacturing, installation, payments.
const ORDER_SEL = "order_id, order_code, status, machine_type, capacity, created_at, sent_at, est_finish_date, customers(name, phone), factories(name), machine_models(name)";
async function fetchOrders(statuses) {
  let q = db.from("orders").select(ORDER_SEL).order("created_at", { ascending: false }).limit(1000);
  if (statuses) q = q.in("status", statuses);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
const must = (r) => { if (r.error) throw r.error; return r.data; };
const head = (title, sub) => `<div class="head"><div><h1>${title}</h1>${sub ? `<div class="muted">${sub}</div>` : ""}</div></div>`;
const orderLink = (o) => `<a class="mono" href="#/order/${o.order_id}"><b>${esc(o.order_code)}</b></a>`;
const who = (o) => `${esc(o.customers?.name)}<div class="small muted">${esc(o.customers?.phone)}</div>`;
const ORDER_COLS = [
  { h: "Order", f: orderLink }, { h: "Customer", f: who },
  { h: "Model", f: (o) => `${esc(o.machine_models?.name ?? o.machine_type)}<div class="small muted">${esc(o.capacity)}</div>` },
  { h: "Status", f: (o) => pill(o.status) }, { h: "Factory", f: (o) => esc(o.factories?.name ?? "-") }, { h: "Ordered", f: (o) => dateTH(o.created_at) },
];
const goOrder = (o) => `#/order/${o.order_id}`;

/* ---------------- Dashboard ---------------- */
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

/* ---------------- Orders ---------------- */
async function ordersPage(el, title, sub, statuses, withStatusFilter) {
  const p = hashParams().get("status");
  const all = await fetchOrders(statuses ?? (p ? [Number(p)] : null));
  el.innerHTML = head(title, sub) + `<div class="card"><div class="filters">
      <input id="q" placeholder="Search: order no. / name / phone">
      ${withStatusFilter ? `<select id="st"><option value="">All statuses</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${p === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>` : ""}
    </div><div id="tb"></div></div>`;
  const draw = () => {
    const q = $("#q").value.trim().toLowerCase(), st = $("#st")?.value;
    const rows = all.filter((o) => (!st || String(o.status) === st) &&
      (!q || [o.order_code, o.customers?.name, o.customers?.phone].some((x) => String(x ?? "").toLowerCase().includes(q))));
    $("#tb").innerHTML = table(ORDER_COLS, rows, goOrder);
  };
  $("#q").oninput = draw; $("#st")?.addEventListener("change", draw); draw();
}
route(/^\/orders$/, (el) => ordersPage(el, "All Orders", "All orders", null, true));
route(/^\/orders\/new$/, (el) => ordersPage(el, "New Orders", "Review new orders, then issue a quote", [0]));
route(/^\/orders\/cancelled$/, (el) => ordersPage(el, "Cancelled", "Cancelled orders", [99]));

route(/^\/orders\/quotations$/, async (el) => {
  const rows = must(await db.from("quotations").select("quotation_id, order_id, total_price, deposit_amount, valid_until, status, created_at, orders(order_code, status, customers(name))").order("created_at", { ascending: false }).limit(500));
  const today = new Date(new Date().toDateString());
  const st = (q) => q.status === "sent" && new Date(q.valid_until) < today ? `<span class="pill bad">Expired</span>` :
    ({ sent: `<span class="pill warn">Awaiting customer</span>`, accepted: `<span class="pill ok">Customer accepted</span>`, rejected: `<span class="pill bad">Rejected</span>`, expired: `<span class="pill bad">Expired</span>` })[q.status];
  el.innerHTML = head("Quotations", "Quotations issued") + `<div class="card">${table([
    { h: "Order", f: (q) => `<a class="mono" href="#/order/${q.order_id}"><b>${esc(q.orders?.order_code)}</b></a>` }, { h: "Customer", f: (q) => esc(q.orders?.customers?.name) },
    { h: "Total (THB)", f: (q) => baht(q.total_price) }, { h: "Deposit", f: (q) => baht(q.deposit_amount) },
    { h: "Valid until", f: (q) => dateTH(q.valid_until) }, { h: "Quote status", f: st }, { h: "Issued", f: (q) => dateTH(q.created_at) },
  ], rows, (q) => `#/order/${q.order_id}`)}</div>`;
});

/* ---------------- Manufacturing ---------------- */
route(/^\/mfg\/requests$/, async (el) => {
  const [orders, asg] = await Promise.all([
    fetchOrders([2, 3]),
    db.from("factory_assignments").select("assignment_id, order_id, response, reject_reason, sent_at, responded_at, factories(name), orders(order_code, customers(name))").order("sent_at", { ascending: false }).limit(300).then(must),
  ]);
  const latest = new Map();
  asg.forEach((a) => { if (!latest.has(a.order_id)) latest.set(a.order_id, a); });
  const toSend = orders.filter((o) => o.status === 2 || (o.status === 3 && latest.get(o.order_id)?.response === "rejected"));
  const waiting = orders.filter((o) => o.status === 3 && latest.get(o.order_id)?.response === "pending");
  const sendCols = [...ORDER_COLS.slice(0, 2), { h: "Note", f: (o) => o.status === 3 ? `<span class="pill bad">${esc(latest.get(o.order_id).factories?.name)} declined: ${esc(latest.get(o.order_id).reject_reason)}</span>` : "Deposit paid" },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">${o.status === 3 ? "Choose another factory" : "Send to factory"}</a>` }];
  const waitCols = [...ORDER_COLS.slice(0, 2), { h: "Factory", f: (o) => esc(o.factories?.name) },
    { h: "Sent", f: (o) => `${dateTH(o.sent_at, true)}${daysAgo(o.sent_at) > 3 ? ` <span class="pill bad">over 3 days</span>` : ""}` },
    { h: "Record the factory's reply", f: (o) => `<button class="btn sm green" data-act="accept" data-o="${o.order_id}">Accepted</button> <button class="btn sm red" data-act="reject" data-o="${o.order_id}">Declined</button>` }];
  el.innerHTML = head("Factory Requests", "Send production orders and record the factory's reply (the shop records on the factory's behalf)") +
    `<div class="card"><h2>To send / needs another factory (${toSend.length})</h2>${table(sendCols, toSend, goOrder)}</div>
     <div class="card"><h2>Waiting for factory reply (${waiting.length})</h2>${table(waitCols, waiting)}</div>
     <div class="card"><h2>Production order history</h2>${table([
       { h: "Order", f: (a) => `<a class="mono" href="#/order/${a.order_id}">${esc(a.orders?.order_code)}</a>` }, { h: "Factory", f: (a) => esc(a.factories?.name) },
       { h: "Sent", f: (a) => dateTH(a.sent_at, true) },
       { h: "Result", f: (a) => ({ pending: `<span class="pill warn">Pending</span>`, accepted: `<span class="pill ok">Accepted</span>`, rejected: `<span class="pill bad">Rejected</span>` })[a.response] },
       { h: "Reason / replied", f: (a) => `${esc(a.reject_reason ?? "")}<div class="small muted">${dateTH(a.responded_at, true)}</div>` },
     ], asg)}</div>`;
  el.onclick = async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const oid = Number(b.dataset.o);
    if (b.dataset.act === "accept") {
      try { await rpc("staff_factory_response", { p_order: oid, p_accept: true }, "Recorded: the factory accepted"); navigate(); } catch (er) { toast(errText(er), true); }
    } else {
      const done = await modal("Factory declined", `<label>Reason the factory declined</label><textarea id="r" rows="3"></textarea>`, { ok: "Save",
        onOk: async (m) => { await rpc("staff_factory_response", { p_order: oid, p_accept: false, p_reason: $("#r", m).value }, "Rejection recorded"); } });
      if (done) navigate();
    }
  };
});

route(/^\/mfg\/production$/, async (el) => {
  const [orders, ups] = await Promise.all([fetchOrders([3, 4]),
    db.from("production_updates").select("order_id, stage, est_finish_date, note, created_at, orders(order_code)").order("created_at", { ascending: false }).limit(50).then(must)]);
  const rows = orders.filter((o) => o.status === 4 || o.status === 3);
  const late = (o) => o.status === 4 && o.est_finish_date && new Date(o.est_finish_date) < new Date(new Date().toDateString());
  el.innerHTML = head("Production", "Track production and estimated finish dates") + `<div class="card"><h2>Production jobs (${rows.length})</h2>${table([
    ...ORDER_COLS.slice(0, 2), { h: "Factory", f: (o) => esc(o.factories?.name) },
    { h: "Status", f: (o) => o.status === 3 ? `<span class="pill warn">Waiting to start / for factory reply</span>` : `<span class="pill">In production</span>` },
    { h: "Est. finish", f: (o) => `${dateTH(o.est_finish_date)}${late(o) ? ` <span class="pill bad">Overdue</span>` : ""}` },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">Manage</a>` },
  ], rows, goOrder)}</div>
  <div class="card"><h2>Latest updates</h2>${table([
    { h: "Order", f: (u) => esc(u.orders?.order_code) }, { h: "Stage", f: (u) => esc({ started: "Started", in_progress: "In progress", finished: "Finished", delayed: "Delayed" }[u.stage]) },
    { h: "ETA", f: (u) => dateTH(u.est_finish_date) }, { h: "Note", f: (u) => esc(u.note ?? "") }, { h: "When", f: (u) => dateTH(u.created_at, true) },
  ], ups)}</div>`;
});

route(/^\/mfg\/qc$/, async (el) => {
  const [orders, res] = await Promise.all([fetchOrders([5, 6]),
    db.from("qc_results").select("order_id, round_no, passed, checked_at, orders(order_code, customers(name))").order("checked_at", { ascending: false }).limit(1000).then(must)]);
  const g = new Map();
  res.forEach((r) => { const k = r.order_id + "-" + r.round_no; const x = g.get(k) ?? { ...r, pass: 0, fail: 0 }; r.passed ? x.pass++ : x.fail++; g.set(k, x); });
  el.innerHTML = head("QC", "Quality check before the install date") + `<div class="card"><h2>Awaiting QC / fixes (${orders.length})</h2>${table([
    ...ORDER_COLS.slice(0, 2), { h: "Status", f: (o) => pill(o.status) }, { h: "Factory", f: (o) => esc(o.factories?.name) },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">${o.status === 5 ? "Run QC" : "View results"}</a>` },
  ], orders, goOrder)}</div>
  <div class="card"><h2>QC history</h2>${table([
    { h: "Order", f: (r) => `<a class="mono" href="#/order/${r.order_id}">${esc(r.orders?.order_code)}</a>` }, { h: "Customer", f: (r) => esc(r.orders?.customers?.name) },
    { h: "Round", f: (r) => r.round_no }, { h: "Result", f: (r) => r.fail ? `<span class="pill bad">Failed ${r.fail} items</span>` : `<span class="pill ok">All passed</span>` },
    { h: "Checked", f: (r) => dateTH(r.checked_at, true) },
  ], [...g.values()])}</div>`;
});

/* ---------------- Installation + customer acceptance ---------------- */
route(/^\/installation$/, async (el) => {
  const [orders, ap, ac] = await Promise.all([fetchOrders([7, 8, 9]),
    db.from("appointments").select("order_id, install_datetime, status, reschedule_count").order("created_at", { ascending: false }).then(must),
    db.from("acceptance_checks").select("order_id, passed, note, checked_at, orders(order_code, customers(name))").order("checked_at", { ascending: false }).limit(200).then(must)]);
  const lastAp = new Map(), lastAc = new Map();
  ap.forEach((a) => { if (!lastAp.has(a.order_id)) lastAp.set(a.order_id, a); });
  ac.forEach((a) => { if (!lastAc.has(a.order_id)) lastAc.set(a.order_id, a); });
  const need = (o) => o.status === 7 ? "Needs a date" : o.status === 8 && lastAp.get(o.order_id)?.status !== "scheduled" ? "Customer asked for a new date" : o.status === 8 ? "Awaiting install day / confirmation" : "Awaiting customer acceptance and payment";
  el.innerHTML = head("Installation", "Schedule install dates, reschedule, and see the customer's acceptance results (the factory does the installation)") + `<div class="card"><h2>Install jobs (${orders.length})</h2>${table([
    ...ORDER_COLS.slice(0, 2), { h: "Status", f: (o) => pill(o.status) },
    { h: "Install date", f: (o) => { const a = lastAp.get(o.order_id); return a ? `${dateTH(a.install_datetime, true)}<div class="small muted">${esc(a.status)}${a.reschedule_count ? ` · rescheduled ${a.reschedule_count}×` : ""}</div>` : "-"; } },
    { h: "To do", f: (o) => `<span class="pill ${need(o) === "Customer asked for a new date" ? "bad" : "warn"}">${need(o)}</span>` },
    { h: "Latest acceptance", f: (o) => { const c = lastAc.get(o.order_id); return c ? (c.passed ? `<span class="pill ok">Passed</span>` : `<span class="pill bad">Failed</span> ${esc(c.note)}`) : "-"; } },
    { h: "", f: (o) => `<a class="btn sm" href="#/order/${o.order_id}">Manage</a>` },
  ], orders, goOrder)}</div>
  <div class="card"><h2>Customer Acceptance</h2>${table([
    { h: "Order", f: (a) => `<a class="mono" href="#/order/${a.order_id}">${esc(a.orders?.order_code)}</a>` }, { h: "Customer", f: (a) => esc(a.orders?.customers?.name) },
    { h: "Result", f: (a) => a.passed ? `<span class="pill ok">Accepted</span>` : `<span class="pill bad">Problem reported</span>` },
    { h: "Problem reported", f: (a) => esc(a.note ?? "") }, { h: "When", f: (a) => dateTH(a.checked_at, true) },
  ], ac)}</div>`;
});

/* ---------------- Payments: deposit / final / refund ---------------- */
const PAY_TITLE = { deposit: "Deposit", final: "Final Payment", refund: "Refund" };
route(/^\/payments\/(deposit|final|refund)$/, async (el, [type]) => {
  const rows = must(await db.from("payments").select("*, orders(order_code, status, customers(name))").eq("pay_type", type).order("paid_at", { ascending: false }).limit(300));
  const sel = hashParams().get("show") ?? "pending";
  const shown = rows.filter((p) => sel === "all" || (sel === "pending") === !p.verified);
  const method = { qr: "QR", transfer: "Transfer", cash: "Cash" };
  el.innerHTML = head(PAY_TITLE[type], { deposit: "Check deposit slips", final: "Check final payment and issue receipt", refund: "Return deposits to customers who cancelled" }[type]) +
    `<div class="card"><div class="filters"><select id="sh"><option value="pending">Pending</option><option value="done">Done</option><option value="all">All</option></select></div>${table([
      { h: "Order", f: (p) => `<a class="mono" href="#/order/${p.order_id}"><b>${esc(p.orders?.order_code)}</b></a>` }, { h: "Customer", f: (p) => esc(p.orders?.customers?.name) },
      { h: "Amount (THB)", f: (p) => baht(p.amount) },
      ...(type === "refund" ? [{ h: "Customer account", f: (p) => esc(p.refund_account ?? "— not given") }] : [{ h: "Method", f: (p) => esc(method[p.payment_method] ?? "-") }]),
      { h: "Slip", f: (p) => p.slip_path ? `<button class="btn sm ghost" data-act="slip" data-p="${p.payment_id}">View</button>` : "-" },
      { h: "Status", f: (p) => p.verified ? `<span class="pill ok">${type === "refund" ? "Refunded" : "Checked"}</span>${p.receipt_no ? `<div class="small mono">${esc(p.receipt_no)}</div>` : ""}` : `<span class="pill warn">Pending</span>` },
      { h: "When", f: (p) => dateTH(p.paid_at, true) },
      { h: "", f: (p) => p.verified ? "" : type === "refund"
        ? `<button class="btn sm green" data-act="refund" data-p="${p.payment_id}">Refund</button>`
        : `<button class="btn sm green" data-act="ok" data-p="${p.payment_id}">Approve</button> <button class="btn sm red" data-act="no" data-p="${p.payment_id}">Reject</button>` },
    ], shown)}</div>`;
  $("#sh").value = sel; $("#sh").onchange = () => { location.hash = `#/payments/${type}?show=${$("#sh").value}`; };
  const byId = new Map(rows.map((p) => [String(p.payment_id), p]));
  el.onclick = async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const p = byId.get(b.dataset.p), act = b.dataset.act;
    const after = () => { refreshCounts(); navigate(); };
    if (act === "slip") return showSlip(p.slip_path);
    if (act === "ok") {
      try { await rpc("staff_verify_payment", { p_payment: p.payment_id, p_approve: true }, type === "final" ? "Approved. Receipt issued, order completed" : "Deposit approved"); after(); } catch (er) { toast(errText(er), true); }
    } else if (act === "no") {
      if (await modal("Reject payment proof", `<label>Reason (the customer is notified)</label><textarea id="r" rows="3"></textarea>`, { ok: "Reject",
        onOk: async (m) => { await rpc("staff_verify_payment", { p_payment: p.payment_id, p_approve: false, p_reason: $("#r", m).value }, "Rejected. The customer was asked to send it again"); } })) after();
    } else if (act === "refund") {
      if (await modal("Transfer deposit back", `<p>Refund <b>${baht(p.amount)} THB</b> to ${esc(p.orders?.customers?.name)}</p><label>Customer account</label><input id="a" value="${esc(p.refund_account ?? "")}"><label style="margin-top:10px">Refund transfer slip</label><input id="f" type="file" accept="image/*">`, { ok: "Confirm refunded",
        onOk: async (m) => {
          const f = $("#f", m).files[0]; if (!f) throw new Error("Please attach the refund transfer slip");
          const path = await uploadSlip(f, `refund-${p.payment_id}`);
          await rpc("staff_confirm_refund", { p_payment: p.payment_id, p_account: $("#a", m).value, p_slip: path }, "Refund recorded");
        } })) after();
    }
  };
});
