// Sidebar: Admin > Users & Roles (view only)
route(/^\/users$/, async (el) => {
  const rows = await db.from("users").select("user_id, name, email, role, is_active, created_at, factories(name)").order("role").order("name").then(must);
  el.innerHTML = head("Users & Roles", "Staff, admin and factory accounts") + `<div class="card"><h2>Users (${rows.length})</h2>${table([
    { h: "Name", f: (u) => esc(u.name) }, { h: "Email", f: (u) => esc(u.email) },
    { h: "Role", f: (u) => esc({ admin: "Admin", shop: "Shop staff", factory: "Factory" }[u.role] ?? u.role) },
    { h: "Factory", f: (u) => esc(u.factories?.name ?? "-") },
    { h: "Status", f: (u) => u.is_active ? `<span class="pill ok">Active</span>` : `<span class="pill">Inactive</span>` }, { h: "Created", f: (u) => dateTH(u.created_at) },
  ], rows)}</div>`;
});
