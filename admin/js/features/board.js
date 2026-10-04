// Board view: a sidebar group's orders laid out as columns (opened with the List | Board switch, ?view=board).
// A board-<group>.js file says which columns the group has; this file decides which column each order sits in.
const BOARDS = {};
function registerBoard(group, cfg) { BOARDS[group] = cfg; }

async function boardData() {
  const [orders, pays, asg, rules] = await Promise.all([
    fetchOrders(null),
    db.from("payments").select("order_id, pay_type").eq("verified", false).then(must),
    db.from("factory_assignments").select("order_id, response, sent_at").order("sent_at", { ascending: false }).then(must),
    db.from("business_rules").select("rule_key, value").then(must),
  ]);
  const latest = new Map();
  asg.forEach((a) => { if (!latest.has(a.order_id)) latest.set(a.order_id, a); });
  const pending = (t) => new Set(pays.filter((p) => p.pay_type === t).map((p) => p.order_id));
  return { orders, latest, dep: pending("deposit"), fin: pending("final"), ref: pending("refund"), rule: Object.fromEntries(rules.map((r) => [r.rule_key, Number(r.value)])) };
}

// [column, shop has to act]. Done orders (10) leave the board; they stay in the lists.
function place(o, c) {
  const id = o.order_id;
  switch (o.status) {
    case 0: return ["new", true];
    case 1: return c.dep.has(id) ? ["deposit", true] : ["quoted", false];
    case 2: return ["factory", true];
    case 3: return c.latest.get(id)?.response === "accepted" ? ["prod", true] : ["factory", true];
    case 4: return ["prod", true];
    case 5: case 6: return ["qc", true];
    case 7: case 8: return ["install", true];
    case 9: return ["final", c.fin.has(id)];
    case 99: return c.ref.has(id) ? ["refund", true] : ["cancelled", false];
    default: return [null, false];
  }
}
function lateNote(o, c) {
  const a = c.latest.get(o.order_id), d = a ? daysAgo(a.sent_at) : 0;
  if (o.status === 3 && a?.response === "pending" && d > c.rule.factory_reply_days) return `No factory reply for ${Math.floor(d)} days`;
  if (o.status === 4 && o.est_finish_date && new Date(o.est_finish_date) < new Date(new Date().toDateString())) return `Past due ${dateTH(o.est_finish_date)}`;
  return "";
}

const BOARD_CSS = `
.board { display: grid; grid-template-columns: repeat(var(--n), minmax(190px, 1fr)); gap: 14px; overflow-x: auto; align-items: start; }
.bcol { background: #eceff0; border-radius: var(--r); padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 130px; }
.bcol h3 { margin: 0 2px 2px; font-size: .88rem; display: flex; justify-content: space-between; }
.bcol h3 span { color: var(--muted); font-weight: 400; }
a.bcard { display: block; background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 9px 11px; text-decoration: none; color: var(--text); font-size: .85rem; transition: border-color .15s, box-shadow .15s; }
a.bcard:hover { border-color: var(--teal); box-shadow: 0 2px 8px rgba(0, 120, 120, .12); }
a.bcard.wait { opacity: .62; }
a.bcard.late { border-color: var(--red); background: var(--red-soft); }
a.bcard .bc { display: flex; justify-content: space-between; align-items: center; font-weight: 700; }
a.bcard .dot { width: 8px; height: 8px; border-radius: 99px; background: var(--teal); }
a.bcard.late .dot { background: var(--red); }
a.bcard .bs { color: var(--muted); font-size: .78rem; margin-top: 2px; }
a.bcard .bl { color: var(--red); font-size: .78rem; margin-top: 4px; }
.bcol .none { color: var(--muted); font-size: .8rem; text-align: center; padding: 14px 0; }`;

async function renderBoard(el, group) {
  if (!document.getElementById("board-css")) { const s = document.createElement("style"); s.id = "board-css"; s.textContent = BOARD_CSS; document.head.append(s); }
  const cfg = BOARDS[group];
  if (!cfg) throw new Error(`board "${group}" is not installed`);
  const c = await boardData();
  const cols = cfg.columns.map(([key, name]) => ({ key, name, cards: [] }));
  const by = Object.fromEntries(cols.map((x) => [x.key, x]));
  c.orders.forEach((o) => { const [k, act] = place(o, c); if (by[k]) by[k].cards.push({ o, act, late: lateNote(o, c) }); });
  const card = ({ o, act, late }) => `<a class="bcard ${act ? "" : "wait"} ${late ? "late" : ""}" href="#/order/${o.order_id}">
      <div class="bc"><span class="mono">${esc(o.order_code)}</span>${act ? `<span class="dot" title="Needs you"></span>` : ""}</div>
      <div class="bs">${esc(o.customers?.name)}</div><div class="bs">${esc(o.machine_models?.name ?? o.machine_type)} · ${esc(o.capacity)}</div>${late ? `<div class="bl">${esc(late)}</div>` : ""}</a>`;
  const rank = (x) => (x.late ? 0 : x.act ? 1 : 2);
  el.innerHTML = head(cfg.title, cfg.sub) + `<div class="board" style="--n:${cols.length}">${cols.map((col) =>
    `<section class="bcol" aria-label="${esc(col.name)}"><h3>${esc(col.name)} <span>${col.cards.length}</span></h3>${
      col.cards.length ? col.cards.sort((a, b) => rank(a) - rank(b)).map(card).join("") : `<div class="none">Nothing here</div>`}</section>`).join("")}</div>`;
}
