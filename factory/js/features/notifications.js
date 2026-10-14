// Sidebar: Notifications (การแจ้งเตือน), also the bell. Messages the system sent this factory, newest first,
// with all / unread tabs. Mark one, or all, read (factory_mark_notifications_read); opening a message's link marks it read.
route(/^\/notifications$/, async (el) => {
  const notes = await fetchFactoryNotes();
  let tab = hashParams().get("tab") === "unread" ? "unread" : "all";
  const draw = () => {
    const unread = notes.filter((n) => !n.read_at);
    const shown = tab === "unread" ? unread : notes;
    el.innerHTML = `<div class="card notes">
      <div class="row-sb"><div class="row" style="gap:14px"><span class="tile">${icon("bell", 22)}</span><h1 style="margin:0">การแจ้งเตือน</h1></div>
        <a class="btn ghost" href="#/dashboard">${icon("x", 16)}ปิด</a></div>
      <div class="row-sb notes-bar"><div class="tabs" role="tablist" style="margin:0">
          <button role="tab" data-tab="all" aria-selected="${tab === "all"}">ทั้งหมด ${notes.length}</button>
          <button role="tab" data-tab="unread" aria-selected="${tab === "unread"}">ยังไม่อ่าน ${unread.length}</button></div>
        <button class="btn ghost" data-all ${unread.length ? "" : "disabled"}>${icon("checks", 16)}ทำเครื่องหมายว่าอ่านทั้งหมด</button></div>
      ${shown.length ? shown.map((n) => {
        const v = noteView(n), read = !!n.read_at;
        return `<article class="note ${read ? "" : "unread"}">
          <div class="row-sb"><span class="small cat ${v.tone}">${esc(v.category)}</span><span class="pill dot ${read ? "mute" : ""}">${read ? "อ่านแล้ว" : "ยังไม่อ่าน"}</span></div>
          <h2>${esc(v.title)}${n.orders ? ` · ${esc(n.orders.order_code)}` : ""}</h2>
          ${v.desc ? `<div class="desc">${esc(v.desc)}</div>` : ""}
          <div class="small muted">${dateTimeTH(n.created_at)} · ${esc(v.original)}</div>
          <div class="row" style="margin-top:12px">
            ${v.href ? `<a class="btn ghost" href="${v.href}" data-open="${n.notification_id}">${icon("arrowUpRight", 16)}ดูรายละเอียด</a>` : ""}
            ${read ? `<button class="btn ghost" disabled>${icon("checks", 16)}อ่านแล้ว</button>`
              : `<button class="btn ghost" data-read="${n.notification_id}">${icon("checks", 16)}ทำเครื่องหมายว่าอ่านแล้ว</button>`}</div>
        </article>`;
      }).join("") : `<div class="empty">${tab === "unread" ? "ไม่มีแจ้งเตือนที่ยังไม่อ่าน" : "ยังไม่มีการแจ้งเตือน"}</div>`}
    </div>`;
  };
  // mark read in the database, then locally (so the list does not jump), and refresh the bell
  const markRead = async (ids) => {
    await rpc("factory_mark_notifications_read", { p_ids: ids });
    const now = new Date().toISOString();
    notes.forEach((n) => { if (!n.read_at && (!ids || ids.includes(n.notification_id))) n.read_at = now; });
    refreshShell();
  };
  el.onclick = async (e) => {
    const t = e.target.closest("[data-tab]"), one = e.target.closest("[data-read]"), all = e.target.closest("[data-all]"), open = e.target.closest("[data-open]");
    try {
      if (t) { tab = t.dataset.tab; history.replaceState(null, "", `#/notifications${tab === "unread" ? "?tab=unread" : ""}`); draw(); }
      else if (one) { one.disabled = true; await markRead([Number(one.dataset.read)]); draw(); }
      else if (all) { all.disabled = true; await markRead(null); toast("ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว"); draw(); }
      else if (open) { const id = Number(open.dataset.open); if (!notes.find((n) => n.notification_id === id)?.read_at) markRead([id]).catch(() => {}); }
    } catch (er) { toast(errText(er), true); draw(); }
  };
  draw();
});
