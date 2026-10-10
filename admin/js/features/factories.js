// Sidebar: Admin > Factories (UC14). Everyone on the shop side can view; only role "admin" can add, edit and deactivate
// (enforced by the database). A factory is deactivated, never deleted, because orders already refer to it.
route(/^\/factories$/, async (el) => {
  const { data: au } = await db.auth.getUser();
  const [facs, asg, me] = await Promise.all([db.from("factories").select("*").order("name").then(must),
    db.from("factory_assignments").select("factory_id, response").then(must),
    db.from("users").select("role, is_active").eq("auth_id", au.user.id).maybeSingle().then(must)]);
  const isAdmin = !!me && me.role === "admin" && me.is_active;
  const n = (f, r) => asg.filter((a) => a.factory_id === f.factory_id && a.response === r).length;

  const fields = (f) => `<label>Factory name</label><input id="nm" maxlength="120" value="${esc(f?.name ?? "")}">
    <label style="margin-top:10px">Contact person</label><input id="ct" maxlength="120" value="${esc(f?.contact_name ?? "")}">
    <label style="margin-top:10px">Phone</label><input id="ph" inputmode="tel" maxlength="20" value="${esc(f?.phone ?? "")}">
    <label style="margin-top:10px">Capacity per month (machines)</label><input id="cp" type="number" min="0" step="1" value="${esc(f?.capacity_per_month ?? "")}">
    ${f ? `<label style="margin-top:10px">Status</label><select id="ac"><option value="1" ${f.is_active ? "selected" : ""}>Active</option><option value="0" ${f.is_active ? "" : "selected"}>Inactive</option></select>
      <p class="small muted" style="margin-top:6px">An inactive factory cannot be chosen for new production orders. Orders already sent to it are not affected${n(f, "pending") ? `, and its ${n(f, "pending")} pending request(s) stay open` : ""}.</p>` : ""}`;

  // read and validate the form; throws a message the modal shows under the fields
  const read = (m, self) => {
    const name = $("#nm", m).value.trim(), contact = $("#ct", m).value.trim(), phone = $("#ph", m).value.trim(), cap = $("#cp", m).value.trim();
    if (!name) throw new Error("Please enter the factory name");
    if (facs.some((x) => x.factory_id !== self?.factory_id && x.name.trim().toLowerCase() === name.toLowerCase())) throw new Error("A factory with this name already exists");
    if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) throw new Error("Please enter a valid phone number");
    if (cap !== "" && !/^\d+$/.test(cap)) throw new Error("Capacity must be a whole number, 0 or more");
    return { name, contact_name: contact || null, phone: phone || null, capacity_per_month: cap === "" ? null : Number(cap) };
  };
  const done = (ok) => ok && navigate();

  el.innerHTML = head("Factories", isAdmin ? "Add and edit the factories the shop sends production orders to" : "Factories the shop sends production orders to (only an admin can edit)") +
    (isAdmin ? `<div class="row" style="margin-bottom:12px"><button class="btn" id="add">Add factory</button></div>` : "") +
    `<div class="card"><h2>Factories (${facs.length})</h2>${table([
      { h: "Name", f: (f) => esc(f.name) }, { h: "Contact", f: (f) => esc(f.contact_name ?? "-") }, { h: "Phone", f: (f) => esc(f.phone ?? "-") },
      { h: "Capacity / month", f: (f) => f.capacity_per_month ?? "-" },
      { h: "Pending", f: (f) => n(f, "pending") }, { h: "Accepted", f: (f) => n(f, "accepted") }, { h: "Declined", f: (f) => n(f, "rejected") },
      { h: "Status", f: (f) => f.is_active ? `<span class="pill ok">Active</span>` : `<span class="pill">Inactive</span>` },
      ...(isAdmin ? [{ h: "", f: (f) => `<button class="btn sm ghost" data-edit="${f.factory_id}">Edit</button>` }] : []),
    ], facs)}</div>`;
  if (!isAdmin) return;

  $("#add", el).onclick = async () => done(await modal("Add factory", fields(null), { ok: "Add",
    onOk: async (m) => {
      const { error } = await db.from("factories").insert({ ...read(m, null), is_active: true });
      if (error) throw error;
      toast("Factory added");
    } }));
  el.onclick = async (e) => {
    const b = e.target.closest("[data-edit]"); if (!b) return;
    const f = facs.find((r) => r.factory_id === Number(b.dataset.edit));
    done(await modal("Edit " + f.name, fields(f), { ok: "Save",
      onOk: async (m) => {
        const { data, error } = await db.from("factories").update({ ...read(m, f), is_active: $("#ac", m).value === "1" })
          .eq("factory_id", f.factory_id).select("factory_id");
        if (error) throw error;
        if (!data.length) throw new Error("Only an admin can change factories"); // row-level security hides the row instead of erroring
        toast("Saved");
      } }));
  };
});
