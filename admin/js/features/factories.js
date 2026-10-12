// Sidebar: Admin > Factories (view only)
route(/^\/factories$/, async (el) => {
  const [facs, asg] = await Promise.all([db.from("factories").select("*").order("name").then(must),
    db.from("factory_assignments").select("factory_id, response").then(must)]);
  const n = (f, r) => asg.filter((a) => a.factory_id === f.factory_id && a.response === r).length;
  el.innerHTML = head("Factories", "Factories the shop sends production orders to") + `<div class="card"><h2>Factories (${facs.length})</h2>${table([
    { h: "Name", f: (f) => esc(f.name) }, { h: "Contact", f: (f) => esc(f.contact_name ?? "-") }, { h: "Phone", f: (f) => esc(f.phone ?? "-") },
    { h: "Capacity / month", f: (f) => f.capacity_per_month ?? "-" },
    { h: "Pending", f: (f) => n(f, "pending") }, { h: "Accepted", f: (f) => n(f, "accepted") }, { h: "Declined", f: (f) => n(f, "rejected") },
    { h: "Status", f: (f) => f.is_active ? `<span class="pill ok">Active</span>` : `<span class="pill">Inactive</span>` },
  ], facs)}</div>`;
});
