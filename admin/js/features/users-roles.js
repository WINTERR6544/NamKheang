// Sidebar: Admin > Users & Roles. Roles: admin (the shop) and factory. Only an active admin can add and edit (enforced by the database).
route(/^\/users$/, async (el) => {
  const { data: au } = await db.auth.getUser();
  const [rows, facs, accts] = await Promise.all([
    db.from("users").select("user_id, auth_id, name, email, role, factory_id, is_active, created_at, factories(name)").order("role").order("name").then(must),
    db.from("factories").select("factory_id, name").eq("is_active", true).order("name").then(must),
    db.rpc("admin_unlinked_accounts").then((r) => r.data ?? [])]);
  const isAdmin = rows.some((u) => u.auth_id === au.user.id && u.role === "admin" && u.is_active);
  const ROLE = { admin: "ผู้ดูแลระบบ (ร้าน)", factory: "โรงงาน" };
  const roleOpts = (sel) => Object.entries(ROLE).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${v}</option>`).join("");
  const facOpts = (sel) => facs.map((f) => `<option value="${f.factory_id}" ${f.factory_id === sel ? "selected" : ""}>${esc(f.name)}</option>`).join("");
  // Add form: a searchable account dropdown (search box + filter); choosing one fills in the name, which stays editable
  const ACC_F = { all: "ทั้งหมด", new: "บัญชีใหม่", cust: "บัญชีลูกค้า" };
  const accLine = (a) => `<span class="pk-n">${esc(a.name)}</span><span class="pk-s">${esc(a.email)}${a.phone ? " · " + esc(a.phone) : ""}</span>${a.is_customer ? `<span class="pill">ลูกค้า</span>` : `<span class="pill ok">ใหม่</span>`}`;
  const picker = () => `<label>บัญชีเข้าสู่ระบบ</label>
    <div class="pk" id="pk"><button type="button" class="pk-btn" aria-haspopup="listbox" aria-expanded="false"><span class="pk-v muted">เลือกบัญชี…</span><span class="pk-c" aria-hidden="true">▾</span></button>
      <div class="pk-panel" hidden><input class="pk-q" type="search" placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร" autocomplete="off">
        <div class="pk-f">${Object.entries(ACC_F).map(([k, v], i) => `<button type="button" data-f="${k}" class="${i ? "" : "on"}">${v}</button>`).join("")}</div>
        <div class="pk-list" role="listbox"></div></div></div>
    <input type="hidden" id="em"><div class="small muted pk-note" hidden style="margin-top:6px">บัญชีนี้เคยใช้เป็นบัญชีลูกค้า เมื่อเพิ่มแล้วจะเข้าสู่ระบบไปที่หน้าร้านหรือโรงงานแทน</div>`;
  const wirePicker = (m) => {
    const pk = $("#pk", m); if (!pk) return;
    const btn = $(".pk-btn", pk), panel = $(".pk-panel", pk), q = $(".pk-q", pk), list = $(".pk-list", pk);
    let f = "all", hi = 0, shown = [];
    const draw = () => {
      const t = q.value.trim().toLowerCase();
      shown = accts.filter((a) => (f === "all" || (f === "cust") === a.is_customer) && (!t || [a.name, a.email, a.phone].some((x) => String(x ?? "").toLowerCase().includes(t))));
      hi = Math.min(hi, Math.max(shown.length - 1, 0));
      list.innerHTML = shown.map((a, i) => `<div class="pk-o${i === hi ? " hi" : ""}${a.email === $("#em", m).value ? " sel" : ""}" role="option" data-i="${i}">${accLine(a)}</div>`).join("")
        || `<div class="pk-empty">${accts.length ? "ไม่พบบัญชีที่ตรงกับคำค้น" : "ยังไม่มีบัญชีที่เพิ่มได้ ให้ผู้ใช้สมัครสมาชิกที่หน้าเข้าสู่ระบบก่อน แล้วกลับมาเลือกที่นี่"}</div>`;
    };
    const open = (v) => { panel.hidden = !v; btn.setAttribute("aria-expanded", v); if (v) { draw(); q.focus(); } };
    const pick = (a) => {
      $("#em", m).value = a.email; $("#nm", m).value = a.name ?? "";
      $(".pk-v", pk).innerHTML = accLine(a); $(".pk-v", pk).classList.remove("muted");
      $(".pk-note", m).hidden = !a.is_customer; open(false); btn.focus();
    };
    btn.onclick = () => open(panel.hidden);
    q.oninput = () => { hi = 0; draw(); };
    $(".pk-f", pk).onclick = (e) => { const b = e.target.closest("[data-f]"); if (!b) return; f = b.dataset.f; hi = 0;
      $$(".pk-f button", pk).forEach((x) => x.classList.toggle("on", x === b)); draw(); q.focus(); };
    list.onmousedown = (e) => { const o = e.target.closest("[data-i]"); if (o) { e.preventDefault(); pick(shown[o.dataset.i]); } };
    q.onkeydown = (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); hi = (hi + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % Math.max(shown.length, 1); draw(); $(".pk-o.hi", list)?.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "Enter") { e.preventDefault(); if (shown[hi]) pick(shown[hi]); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); open(false); btn.focus(); }
    };
    m.addEventListener("mousedown", (e) => { if (!pk.contains(e.target)) open(false); });
  };
  // the factory picker only matters for the Factory role
  const wire = (m) => {
    wirePicker(m);
    const sync = () => { $("#fw", m).hidden = $("#ro", m).value !== "factory"; }; $("#ro", m).onchange = sync; sync();
  };
  const fields = (u) => `${u ? "" : picker()}
    <label${u ? "" : ` style="margin-top:10px"`}>ชื่อ</label><input id="nm" value="${esc(u?.name ?? "")}" placeholder="${u ? "" : "เลือกบัญชีแล้วชื่อจะขึ้นให้ แก้ไขได้"}">
    <label style="margin-top:10px">บทบาท</label><select id="ro">${roleOpts(u?.role ?? "admin")}</select>
    <div id="fw"><label style="margin-top:10px">โรงงาน</label><select id="fa">${facOpts(u?.factory_id)}</select></div>
    ${u ? `<label style="margin-top:10px">สถานะ</label><select id="ac"><option value="1" ${u.is_active ? "selected" : ""}>ใช้งาน</option><option value="0" ${u.is_active ? "" : "selected"}>ปิดใช้งาน</option></select>` : ""}`;
  const fac = (m) => ($("#ro", m).value === "factory" ? Number($("#fa", m).value) || null : null);
  const done = (ok) => ok && navigate();
  el.innerHTML = head("ผู้ใช้และสิทธิ์", isAdmin ? "เพิ่มและแก้ไขบัญชีผู้ดูแลระบบ (ร้าน) และโรงงาน" : "บัญชีผู้ดูแลระบบ (ร้าน) และโรงงาน") +
    (isAdmin ? `<div class="row" style="margin-bottom:12px"><button class="btn" id="add">เพิ่มผู้ใช้</button></div>` : "") +
    `<div class="card"><h2>ผู้ใช้ (${rows.length})</h2>${table([
      { h: "ชื่อ", f: (u) => esc(u.name) }, { h: "อีเมล", f: (u) => esc(u.email) }, { h: "บทบาท", f: (u) => esc(ROLE[u.role] ?? u.role) },
      { h: "โรงงาน", f: (u) => esc(u.factories?.name ?? "-") },
      { h: "สถานะ", f: (u) => (u.is_active ? `<span class="pill ok">ใช้งาน</span>` : `<span class="pill">ปิดใช้งาน</span>`) + (u.auth_id ? "" : ` <span class="pill warn">ยังไม่มีบัญชีเข้าสู่ระบบ</span>`) },
      { h: "วันที่สร้าง", f: (u) => dateTH(u.created_at) },
      ...(isAdmin ? [{ h: "", f: (u) => `<button class="btn sm ghost" data-edit="${u.user_id}">แก้ไข</button>` }] : []),
    ], rows)}</div>`;
  if (!isAdmin) return;
  $("#add", el).onclick = async () => done(await modal("เพิ่มผู้ใช้", fields(null), { ok: "เพิ่ม", onOpen: wire,
    onOk: (m) => { if (!$("#em", m).value) throw new Error("กรุณาเลือกบัญชีเข้าสู่ระบบก่อน");
      if (!$("#nm", m).value.trim()) throw new Error("กรุณากรอกชื่อ");
      return rpc("admin_add_user", { p_name: $("#nm", m).value, p_email: $("#em", m).value, p_role: $("#ro", m).value, p_factory: fac(m) }, "เพิ่มผู้ใช้แล้ว"); } }));
  el.onclick = async (e) => {
    const b = e.target.closest("[data-edit]"); if (!b) return;
    const u = rows.find((r) => r.user_id === Number(b.dataset.edit));
    done(await modal("แก้ไข " + u.name, fields(u), { ok: "บันทึก", onOpen: wire,
      onOk: (m) => rpc("admin_update_user", { p_user: u.user_id, p_name: $("#nm", m).value, p_role: $("#ro", m).value, p_factory: fac(m), p_active: $("#ac", m).value === "1" }, "บันทึกแล้ว") }));
  };
});
