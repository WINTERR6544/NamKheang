// Admin > บัญชีและสิทธิ์ > tab โรงงาน (UC14): add, edit and deactivate factory companies (role "admin", enforced by the database).
// (enforced by the database). A factory is deactivated, never deleted, because orders already refer to it.
// renderFactories(el, embedded): embedded = drawn inside the accounts page (no page heading)
async function renderFactories(el, embedded) {
  const { data: au } = await db.auth.getUser();
  const [facs, asg, me] = await Promise.all([db.from("factories").select("*").order("name").then(must),
    db.from("factory_assignments").select("factory_id, response").then(must),
    db.from("users").select("role, is_active").eq("auth_id", au.user.id).maybeSingle().then(must)]);
  const isAdmin = !!me && me.role === "admin" && me.is_active;
  const n = (f, r) => asg.filter((a) => a.factory_id === f.factory_id && a.response === r).length;

  const fields = (f) => `<label>ชื่อโรงงาน</label><input id="nm" maxlength="120" value="${esc(f?.name ?? "")}">
    <label style="margin-top:10px">ผู้ติดต่อ</label><input id="ct" maxlength="120" value="${esc(f?.contact_name ?? "")}">
    <label style="margin-top:10px">เบอร์โทร</label><input id="ph" inputmode="tel" maxlength="20" value="${esc(f?.phone ?? "")}">
    <label style="margin-top:10px">กำลังผลิตต่อเดือน (เครื่อง)</label><input id="cp" type="number" min="0" step="1" value="${esc(f?.capacity_per_month ?? "")}">
    ${f ? `<label style="margin-top:10px">สถานะ</label><select id="ac"><option value="1" ${f.is_active ? "selected" : ""}>ใช้งาน</option><option value="0" ${f.is_active ? "" : "selected"}>ปิดใช้งาน</option></select>
      <p class="small muted" style="margin-top:6px">โรงงานที่ปิดใช้งานจะเลือกส่งคำสั่งผลิตใหม่ไม่ได้ คำสั่งซื้อที่ส่งไปแล้วไม่ได้รับผลกระทบ${n(f, "pending") ? ` และคำขอที่รอตอบรับ ${n(f, "pending")} รายการยังคงเปิดอยู่` : ""}</p>` : ""}`;

  // read and validate the form; throws a message the modal shows under the fields
  const read = (m, self) => {
    const name = $("#nm", m).value.trim(), contact = $("#ct", m).value.trim(), phone = $("#ph", m).value.trim(), cap = $("#cp", m).value.trim();
    if (!name) throw new Error("กรุณากรอกชื่อโรงงาน");
    if (facs.some((x) => x.factory_id !== self?.factory_id && x.name.trim().toLowerCase() === name.toLowerCase())) throw new Error("มีโรงงานชื่อนี้อยู่แล้ว");
    if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) throw new Error("กรุณากรอกเบอร์โทรให้ถูกต้อง");
    if (cap !== "" && !/^\d+$/.test(cap)) throw new Error("กำลังผลิตต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป");
    return { name, contact_name: contact || null, phone: phone || null, capacity_per_month: cap === "" ? null : Number(cap) };
  };
  const done = (ok) => ok && navigate();

  el.innerHTML = (embedded ? "" : head("โรงงาน", "เพิ่มและแก้ไขโรงงานที่ร้านส่งคำสั่งผลิตให้")) +
    (isAdmin ? `<div class="row" style="margin-bottom:12px"><button class="btn" id="add">เพิ่มโรงงาน</button></div>` : "") +
    `<div class="card"><h2>โรงงาน (${facs.length})</h2>${table([
      { h: "ชื่อ", f: (f) => esc(f.name) }, { h: "ผู้ติดต่อ", f: (f) => esc(f.contact_name ?? "-") }, { h: "เบอร์โทร", f: (f) => esc(f.phone ?? "-") },
      { h: "กำลังผลิต / เดือน", f: (f) => f.capacity_per_month ?? "-" },
      { h: "รอตอบรับ", f: (f) => n(f, "pending") }, { h: "ตอบรับ", f: (f) => n(f, "accepted") }, { h: "ปฏิเสธ", f: (f) => n(f, "rejected") },
      { h: "สถานะ", f: (f) => f.is_active ? `<span class="pill ok">ใช้งาน</span>` : `<span class="pill">ปิดใช้งาน</span>` },
      ...(isAdmin ? [{ h: "", f: (f) => `<button class="btn sm ghost" data-edit="${f.factory_id}">แก้ไข</button>` }] : []),
    ], facs)}</div>`;
  if (!isAdmin) return;

  $("#add", el).onclick = async () => done(await modal("เพิ่มโรงงาน", fields(null), { ok: "เพิ่ม",
    onOk: async (m) => {
      const { error } = await db.from("factories").insert({ ...read(m, null), is_active: true });
      if (error) throw error;
      toast("เพิ่มโรงงานแล้ว");
    } }));
  el.onclick = async (e) => {
    const b = e.target.closest("[data-edit]"); if (!b) return;
    const f = facs.find((r) => r.factory_id === Number(b.dataset.edit));
    done(await modal("แก้ไข " + f.name, fields(f), { ok: "บันทึก",
      onOk: async (m) => {
        const { data, error } = await db.from("factories").update({ ...read(m, f), is_active: $("#ac", m).value === "1" })
          .eq("factory_id", f.factory_id).select("factory_id");
        if (error) throw error;
        if (!data.length) throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขโรงงานได้"); // row-level security hides the row instead of erroring
        toast("บันทึกแล้ว");
      } }));
  };
}
