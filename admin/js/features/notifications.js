// Sidebar: Notifications (also the bell). Messages the system sent to the shop, newest first:
// new orders, slips to check, factory replies and reminders, reschedule requests, customer problems,
// refund accounts. Shop messages are shared by all shop staff; marking one read marks it for everyone.
route(/^\/notifications$/, async (el) => {
  const notes = must(await db.from("notifications").select("notification_id, order_id, message, read_at, created_at, orders(order_code)")
    .eq("recipient_type", "shop").order("created_at", { ascending: false }).limit(200));
  let tab = hashParams().get("tab") === "unread" ? "unread" : "all";
  const draw = () => {
    const unread = notes.filter((n) => !n.read_at), shown = tab === "unread" ? unread : notes;
    el.innerHTML = head("Notifications", "What happened on orders that needs the shop. Shop messages are shared by all shop staff") +
      `<div class="card notes">
        <div class="row-sb notes-bar"><div class="tabs" role="tablist" style="margin:0">
            <button role="tab" data-tab="all" aria-selected="${tab === "all"}">All ${notes.length}</button>
            <button role="tab" data-tab="unread" aria-selected="${tab === "unread"}">Unread ${unread.length}</button></div>
          <button class="btn ghost" data-all ${unread.length ? "" : "disabled"}>${icon("checks", 16)}Mark all as read</button></div>
        ${shown.length ? shown.map((n) => `<article class="note ${n.read_at ? "" : "unread"}">
            <div class="row-sb"><span class="small muted">${dateTH(n.created_at, true)}</span><span class="pill dot ${n.read_at ? "mute" : ""}">${n.read_at ? "Read" : "Unread"}</span></div>
            <div class="desc">${esc(n.message)}</div>
            <div class="row" style="margin-top:10px">
              ${n.order_id ? `<a class="btn ghost sm" href="#/order/${n.order_id}" data-open="${n.notification_id}">${icon("arrowUpRight", 14)}Open order</a>` : ""}
              ${n.read_at ? "" : `<button class="btn ghost sm" data-read="${n.notification_id}">${icon("check", 14)}Mark as read</button>`}</div>
          </article>`).join("") : `<div class="empty">${tab === "unread" ? "No unread notifications" : "No notifications yet"}</div>`}
      </div>`;
  };
  const mark = async (ids) => {
    await rpc("staff_mark_notifications_read", { p_ids: ids });
    const now = new Date().toISOString();
    notes.forEach((n) => { if (!ids || ids.includes(n.notification_id)) n.read_at ||= now; });
    draw(); refreshCounts();
  };
  el.onclick = async (e) => {
    const t = e.target.closest("[data-tab], [data-all], [data-read], [data-open]"); if (!t) return;
    try {
      if (t.dataset.tab) { tab = t.dataset.tab; draw(); }
      else if (t.hasAttribute("data-all")) await mark(null);
      else if (t.dataset.read) await mark([Number(t.dataset.read)]);
      else if (t.dataset.open) { const n = notes.find((x) => String(x.notification_id) === t.dataset.open); if (n && !n.read_at) mark([n.notification_id]); }
    } catch (er) { toast(errText(er), true); }
  };
  draw();
});
