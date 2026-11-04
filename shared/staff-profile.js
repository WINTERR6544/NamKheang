// Profile page (#/profile) for shop and factory users. Classic script, loaded after js/core.js by
// admin/index.html and factory/index.html. Uses staff-lib.js (db, $, esc, icon, toast, route) and
// window.ME / initials() from the site's core.js.
// - view: name, email, role, factory (factory users), status, member since
// - edit name: staff_update_my_profile (role, factory, email and active flag are changed by an admin on Users & Roles)
// - change password: supabase auth updateUser
// - profile picture: ../shared/avatar.js (NKAvatar)
const ROLE_TH = { admin: "ผู้ดูแลระบบ", shop: "พนักงานร้าน", factory: "ผู้ใช้โรงงาน" };
// show / hide password button (same eye / eye-off icons as the sign-in page): eye = show, eye-off = hide
const revealBtn = (id) =>
  `<button type="button" class="pass-reveal" data-reveal="${id}" aria-controls="${id}" aria-label="แสดงรหัสผ่าน" aria-pressed="false">${icon("eye", 20)}</button>`;
function setShown(btn, shown) {
  document.getElementById(btn.dataset.reveal).type = shown ? "text" : "password";
  btn.innerHTML = icon(shown ? "eyeOff" : "eye", 20);
  btn.setAttribute("aria-pressed", String(shown));
  btn.setAttribute("aria-label", shown ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน");
}
const longDateTH = (s) => (s ? new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "-");

route(/^\/profile$/, async (el) => {
  const { data: auth } = await db.auth.getUser();
  const me = must(await db.from("users").select("user_id, name, email, role, factory_id, is_active, created_at")
    .eq("auth_id", auth.user.id).maybeSingle());
  if (!me) throw new Error("ไม่พบข้อมูลบัญชี กรุณาติดต่อผู้ดูแลระบบ");
  const factory = me.factory_id
    ? (await db.from("factories").select("name").eq("factory_id", me.factory_id).maybeSingle()).data
    : null;
  const email = auth.user.email || me.email || "-";
  let avatarUrl = NKAvatar.urlOf(auth.user);

  const draw = (editing) => {
    el.innerHTML = `
      <div class="head"><div><h1>โปรไฟล์ของฉัน</h1><div class="muted">ดูและแก้ไขข้อมูลบัญชีของคุณ</div></div></div>
      <div class="grid profile-grid">
        <div class="card">
          <div class="profile-id">
            <span class="avatar lg">${esc(initials(me.name))}</span>
            <div><h2>${esc(me.name)}</h2><div class="muted">${esc(email)}</div>
              <span class="pill dot ${me.is_active ? "ok" : "bad"}">${me.is_active ? "ใช้งานอยู่" : "ปิดการใช้งาน"}</span>
              <div class="row av-actions" id="pf-av"></div></div>
          </div>
          <hr>
          ${editing ? `
            <form id="pf-name" novalidate>
              <label for="pf-n">ชื่อที่แสดง</label>
              <input id="pf-n" maxlength="120" required value="${esc(me.name)}" autocomplete="name">
              <div class="small muted" style="margin-top:4px">2–120 ตัวอักษร</div>
              <div class="err" id="pf-ner" hidden></div>
              <div class="row end" style="margin-top:14px">
                <button type="button" class="btn ghost" id="pf-cancel">ยกเลิก</button>
                <button class="btn" id="pf-save">${icon("check", 16)}บันทึก</button></div>
            </form>` : `
            <dl class="spec2">
              <dt>ชื่อ</dt><dd>${esc(me.name)}</dd>
              <dt>อีเมล</dt><dd>${esc(email)}</dd>
              <dt>บทบาท</dt><dd>${esc(ROLE_TH[me.role] || me.role)}</dd>
              ${me.role === "factory" ? `<dt>โรงงาน</dt><dd>${esc(factory?.name || "-")}</dd>` : ""}
              <dt>เข้าร่วมเมื่อ</dt><dd>${longDateTH(me.created_at)}</dd>
            </dl>
            <div class="row end" style="margin-top:16px"><button class="btn ghost" id="pf-edit">${icon("user", 16)}แก้ไขชื่อ</button></div>
            <p class="small muted" style="margin:12px 0 0">เปลี่ยนอีเมล บทบาท หรือโรงงาน: ติดต่อผู้ดูแลระบบ</p>`}
        </div>
        <div class="card">
          <h2>เปลี่ยนรหัสผ่าน</h2><div class="muted">อย่างน้อย 8 ตัวอักษร</div>
          <form id="pf-pass" style="margin-top:14px" novalidate>
            <input type="text" autocomplete="username" value="${esc(email)}" hidden>
            <label for="pf-p1">รหัสผ่านใหม่</label>
            <div class="pass-wrap"><input id="pf-p1" type="password" minlength="8" required autocomplete="new-password">${revealBtn("pf-p1")}</div>
            <label for="pf-p2" style="margin-top:12px">ยืนยันรหัสผ่านใหม่</label>
            <div class="pass-wrap"><input id="pf-p2" type="password" minlength="8" required autocomplete="new-password">${revealBtn("pf-p2")}</div>
            <div class="err" id="pf-per" hidden></div>
            <div class="row end" style="margin-top:14px"><button class="btn" id="pf-psave">${icon("shield", 16)}เปลี่ยนรหัสผ่าน</button></div>
          </form>
        </div>
      </div>`;

    // picture: shown in the big circle, the top bar and the sidebar
    const paintAll = (url) => NKAvatar.paint([$(".avatar.lg", el), $("#av"), $(".who .avatar")], url);
    paintAll(avatarUrl);
    NKAvatar.picker($("#pf-av"), db, avatarUrl, (url) => { avatarUrl = url; paintAll(url); }, toast);

    if (editing) {
      $("#pf-n").focus();
      $("#pf-cancel").onclick = () => draw(false);
      $("#pf-name").onsubmit = async (e) => {
        e.preventDefault();
        const er = $("#pf-ner"), name = $("#pf-n").value.trim();
        er.hidden = true;
        if (name.length < 2 || name.length > 120) { er.textContent = "กรุณากรอกชื่อ 2–120 ตัวอักษร"; er.hidden = false; return; }
        $("#pf-save").disabled = true;
        try {
          await rpc("staff_update_my_profile", { p_name: name }, "บันทึกชื่อแล้ว");
          me.name = name;
          if (window.ME) window.ME.name = name;
          // the same name shows in the top bar and at the bottom of the sidebar
          $("#mename").textContent = name; $("#av").textContent = initials(name);
          const who = $(".who"); if (who) { $(".avatar", who).textContent = initials(name); $("b", who).textContent = name; }
          draw(false);
        } catch (err) {
          er.textContent = /INVALID_NAME/.test(err.message) ? "กรุณากรอกชื่อ 2–120 ตัวอักษร" : errText(err);
          er.hidden = false; $("#pf-save").disabled = false;
        }
      };
    } else {
      $("#pf-edit").onclick = () => draw(true);
    }

    const reveals = [...el.querySelectorAll("[data-reveal]")];
    reveals.forEach((b) => (b.onclick = () => {
      const input = document.getElementById(b.dataset.reveal);
      setShown(b, input.type === "password");
      input.focus();
    }));
    $("#pf-pass").onsubmit = async (e) => {
      e.preventDefault();
      reveals.forEach((b) => setShown(b, false)); // hide again so the password isn't left on screen
      const er = $("#pf-per"), p1 = $("#pf-p1").value, p2 = $("#pf-p2").value;
      er.hidden = true;
      const fail = (msg) => { er.textContent = msg; er.hidden = false; };
      if (p1.length < 8) return fail("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      if (p1 !== p2) return fail("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      $("#pf-psave").disabled = true;
      const { error } = await db.auth.updateUser({ password: p1 });
      $("#pf-psave").disabled = false;
      if (error) {
        return fail(/different from the old/i.test(error.message) ? "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม"
          : /weak|short|characters/i.test(error.message) ? "รหัสผ่านง่ายเกินไป กรุณาตั้งให้ยาวหรือซับซ้อนขึ้น"
          : /reauth|recent/i.test(error.message) ? "เพื่อความปลอดภัย กรุณาออกจากระบบแล้วเข้าใหม่ก่อนเปลี่ยนรหัสผ่าน"
          : error.message);
      }
      $("#pf-p1").value = ""; $("#pf-p2").value = "";
      toast("เปลี่ยนรหัสผ่านแล้ว");
    };
  };
  draw(hashParams().get("edit") === "1");
});
