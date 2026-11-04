// Sidebar: Admin > Users & Roles. Everyone on the shop side can view; only role "admin" can add and edit (enforced by the database).
route(/^\/users$/, async (el) => {
  const { data: au } = await db.auth.getUser();
  const [rows, facs, accts] = await Promise.all([
    db.from("users").select("user_id, auth_id, name, email, role, factory_id, is_active, created_at, factories(name)").order("role").order("name").then(must),
    db.from("factories").select("factory_id, name").eq("is_active", true).order("name").then(must),
    db.rpc("admin_unlinked_accounts").then((r) => r.data ?? [])]);
  const isAdmin = rows.some((u) => u.auth_id === au.user.id && u.role === "admin" && u.is_active);
  const ROLE = { admin: "ผู้ดูแลระบบ", shop: "พนักงานร้าน", factory: "โรงงาน" };
  const roleOpts = (sel) => Object.entries(ROLE).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${v}</option>`).join("");
  const facOpts = (sel) => facs.map((f) => `<option value="${f.factory_id}" ${f.factory_id === sel ? "selected" : ""}>${esc(f.name)}</option>`).join("");
  // the factory picker only matters for the Factory role
  const wire = (m) => {
    const em = $("#em", m); // Add form: choosing an account fills in the name
    if (em) { const fill = () => { $("#nm", m).value = accts.find((a) => a.email === em.value)?.name ?? ""; }; em.onchange = fill; fill(); }
    const sync = () => { $("#fw", m).hidden = $("#ro", m).value !== "factory"; }; $("#ro", m).onchange = sync; sync();
  };
  const fields = (u) => `<label>ชื่อ</label><input id="nm" value="${esc(u?.name ?? "")}">
    ${u ? "" : `<label style="margin-top:10px">บัญชีเข้าสู่ระบบ</label><select id="em">${accts.map((a) => `<option value="${esc(a.email)}">${esc(a.email)}</option>`).join("") || `<option value="">ไม่มีบัญชีว่าง กรุณาสร้างบัญชีใน Supabase ก่อน</option>`}</select>`}
    <label style="margin-top:10px">บทบาท</label><select id="ro">${roleOpts(u?.role ?? "shop")}</select>
    <div id="fw"><label style="margin-top:10px">โรงงาน</label><select id="fa">${facOpts(u?.factory_id)}</select></div>
    ${u ? `<label style="margin-top:10px">สถานะ</label><select id="ac"><option value="1" ${u.is_active ? "selected" : ""}>ใช้งาน</option><option value="0" ${u.is_active ? "" : "selected"}>ปิดใช้งาน</option></select>` : ""}`;
  const fac = (m) => ($("#ro", m).value === "factory" ? Number($("#fa", m).value) || null : null);
  const done = (ok) => ok && navigate();
  el.innerHTML = head("ผู้ใช้และสิทธิ์", isAdmin ? "เพิ่มและแก้ไขบัญชีพนักงานร้าน ผู้ดูแลระบบ และโรงงาน" : "บัญชีพนักงานร้าน ผู้ดูแลระบบ และโรงงาน (แก้ไขได้เฉพาะผู้ดูแลระบบ)") +
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
    onOk: (m) => rpc("admin_add_user", { p_name: $("#nm", m).value, p_email: $("#em", m).value, p_role: $("#ro", m).value, p_factory: fac(m) }, "เพิ่มผู้ใช้แล้ว") }));
  el.onclick = async (e) => {
    const b = e.target.closest("[data-edit]"); if (!b) return;
    const u = rows.find((r) => r.user_id === Number(b.dataset.edit));
    done(await modal("แก้ไข " + u.name, fields(u), { ok: "บันทึก", onOpen: wire,
      onOk: (m) => rpc("admin_update_user", { p_user: u.user_id, p_name: $("#nm", m).value, p_role: $("#ro", m).value, p_factory: fac(m), p_active: $("#ac", m).value === "1" }, "บันทึกแล้ว") }));
  };
});
