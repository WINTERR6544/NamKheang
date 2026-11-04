// Sidebar: Admin > บัญชีและสิทธิ์ (UC14 + UC15). One page, two tabs:
//   บัญชี   every sign-in account (customer, admin, factory): search + filter, change role, activate / deactivate
//   โรงงาน  factory companies (renderFactories from factories.js)
// Rules live in the database (admin_set_account): not yourself, a customer with orders in progress can't become staff,
// deactivated = can't sign in at all. The old pages #/customers, #/users and #/factories open this page.
route(/^\/(customers|users)$/, async () => { location.replace("#/accounts"); });
route(/^\/factories$/, async () => { location.replace("#/accounts?tab=factories"); });

route(/^\/accounts$/, async (el) => {
  const tab = hashParams().get("tab") === "factories" ? "factories" : "accounts";
  el.innerHTML = head("บัญชีและสิทธิ์", "บัญชีเข้าสู่ระบบทั้งหมดของลูกค้า ผู้ดูแลระบบ และโรงงาน") +
    `<div class="tabs" role="tablist">${[["accounts", "บัญชีผู้ใช้"], ["factories", "โรงงาน"]].map(([k, v]) =>
      `<button type="button" role="tab" aria-selected="${k === tab}" data-tab="${k}">${v}</button>`).join("")}</div><div id="tabBody"></div>`;
  $(".tabs", el).onclick = (e) => { const b = e.target.closest("[data-tab]"); if (b) location.hash = b.dataset.tab === "factories" ? "#/accounts?tab=factories" : "#/accounts"; };
  const box = $("#tabBody", el);
  if (tab === "factories") { await loadFeature("factories"); return renderFactories(box, true); }

  const { data: au } = await db.auth.getUser();
  const [accts, facs] = await Promise.all([
    db.rpc("admin_accounts").then(must),
    db.from("factories").select("factory_id, name").eq("is_active", true).order("name").then(must)]);
  const ROLE = { customer: "ลูกค้า", admin: "ผู้ดูแลระบบ (ร้าน)", factory: "โรงงาน" };
  const ROLE_PILL = { customer: "", admin: "ok", factory: "warn" };
  const count = (f) => accts.filter(f).length;

  box.innerHTML = `<div class="card"><div class="filters">
      <input id="q" type="search" placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร" autocomplete="off" style="flex:1;min-width:240px">
      <select id="fr"><option value="">ทุกบทบาท (${accts.length})</option>${Object.entries(ROLE).map(([k, v]) => `<option value="${k}">${v} (${count((a) => a.role === k)})</option>`).join("")}</select>
      <select id="fs"><option value="">ทุกสถานะ</option><option value="1">ใช้งาน (${count((a) => a.is_active)})</option><option value="0">ปิดใช้งาน (${count((a) => !a.is_active)})</option></select>
    </div><div id="list"></div></div>`;

  const draw = () => {
    const t = $("#q", box).value.trim().toLowerCase(), r = $("#fr", box).value, s = $("#fs", box).value;
    const rows = accts.filter((a) => (!r || a.role === r) && (!s || String(+a.is_active) === s) &&
      (!t || [a.name, a.email, a.phone, a.factory_name].some((x) => String(x ?? "").toLowerCase().includes(t))));
    $("#list", box).innerHTML = `<div class="small muted" style="margin-bottom:8px">แสดง ${rows.length} จาก ${accts.length} บัญชี</div>` + table([
      { h: "ชื่อ", f: (a) => `<b>${esc(a.name)}</b>${a.auth_id === au.user.id ? ` <span class="pill">คุณ</span>` : ""}<div class="small muted">${esc(a.email)}</div>` },
      { h: "เบอร์โทร", f: (a) => esc(a.phone ?? "-") },
      { h: "บทบาท", f: (a) => `<span class="pill ${ROLE_PILL[a.role]}">${ROLE[a.role]}</span>${a.factory_name ? `<div class="small muted">${esc(a.factory_name)}</div>` : ""}` },
      { h: "คำสั่งซื้อ", f: (a) => a.orders ? `${a.orders}${a.open_orders ? ` <span class="small muted">· กำลังดำเนินการ ${a.open_orders}</span>` : ""}` : "-" },
      { h: "สถานะ", f: (a) => a.is_active ? `<span class="pill ok">ใช้งาน</span>` : `<span class="pill bad">ปิดใช้งาน</span>` },
      { h: "เข้าใช้ล่าสุด", f: (a) => a.last_sign_in ? dateTH(a.last_sign_in, true) : `<span class="muted">ยังไม่เคย</span>` },
      { h: "", f: (a) => a.auth_id === au.user.id ? "" : `<button class="btn sm ghost" data-edit="${a.auth_id}">จัดการ</button>` },
    ], rows);
  };
  $("#q", box).oninput = draw; $("#fr", box).onchange = draw; $("#fs", box).onchange = draw;
  draw();

  const roleOpts = (sel) => Object.entries(ROLE).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${v}</option>`).join("");
  const facOpts = (sel) => facs.map((f) => `<option value="${f.factory_id}" ${f.factory_id === sel ? "selected" : ""}>${esc(f.name)}</option>`).join("")
    || `<option value="">ยังไม่มีโรงงานที่เปิดใช้งาน</option>`;
  box.onclick = async (e) => {
    const b = e.target.closest("[data-edit]"); if (!b) return;
    const a = accts.find((x) => x.auth_id === b.dataset.edit);
    const ok = await modal("จัดการบัญชี", `<div style="margin-bottom:12px"><b>${esc(a.name)}</b><div class="small muted">${esc(a.email)}${a.phone ? " · " + esc(a.phone) : ""}</div></div>
      <label>บทบาท</label><select id="ro">${roleOpts(a.role)}</select>
      <div id="fw"><label style="margin-top:10px">โรงงานที่สังกัด</label><select id="fa">${facOpts(a.factory_id)}</select></div>
      <label style="margin-top:10px">สถานะ</label><select id="ac"><option value="1" ${a.is_active ? "selected" : ""}>ใช้งาน</option><option value="0" ${a.is_active ? "" : "selected"}>ปิดใช้งาน</option></select>
      <div class="small muted" id="hint" style="margin-top:10px"></div>`, { ok: "บันทึก",
      onOpen: (m) => {
        const sync = () => {
          const ro = $("#ro", m).value, on = $("#ac", m).value === "1";
          $("#fw", m).hidden = ro !== "factory";
          $("#hint", m).innerHTML = [
            ro !== a.role && a.role === "customer" && a.open_orders ? `<span style="color:var(--red)">ลูกค้ารายนี้มีคำสั่งซื้อที่กำลังดำเนินการ ${a.open_orders} รายการ ต้องให้เสร็จหรือยกเลิกก่อนจึงเปลี่ยนบทบาทได้</span>` : "",
            ro !== a.role ? { customer: "เมื่อบันทึก บัญชีนี้จะเข้าสู่ระบบไปที่หน้าลูกค้า", admin: "เมื่อบันทึก บัญชีนี้จะเข้าหน้าร้านและจัดการได้ทุกอย่าง", factory: "เมื่อบันทึก บัญชีนี้จะเข้าหน้าโรงงาน เห็นเฉพาะงานของโรงงานที่เลือก" }[ro] : "",
            !on && a.is_active ? "ปิดใช้งานแล้วบัญชีนี้จะเข้าสู่ระบบไม่ได้ ข้อมูลคำสั่งซื้อและประวัติยังอยู่ครบ" : "",
            on && !a.is_active ? "เปิดใช้งานแล้วบัญชีนี้จะเข้าสู่ระบบได้ตามปกติ" : "",
          ].filter(Boolean).join("<br>");
        };
        $("#ro", m).onchange = sync; $("#ac", m).onchange = sync; sync();
      },
      onOk: (m) => {
        const ro = $("#ro", m).value, on = $("#ac", m).value === "1", fa = ro === "factory" ? Number($("#fa", m).value) || null : null;
        if (ro === a.role && on === a.is_active && (ro !== "factory" || fa === a.factory_id)) throw new Error("ยังไม่ได้เปลี่ยนแปลงอะไร");
        if (ro === "factory" && !fa) throw new Error("กรุณาเลือกโรงงานที่สังกัด");
        return rpc("admin_set_account", { p_auth: a.auth_id, p_role: ro, p_factory: fa, p_active: on }, "บันทึกแล้ว");
      } });
    if (ok) navigate();
  };
});
