import {
  $,
  heading,
  card,
  button,
  loading,
  empty,
  busy,
  toast,
  errorState,
} from "../components/customer_ui.js";
import {
  listNotifications,
  markRead,
} from "../services/customer_notification_service.js";
import { esc, date, orderUrl } from "../lib.js";
import { errorMessage } from "../customer_errors.js";
import { refreshUnread } from "../components/customer_layout.js";
export async function render(context, el) {
  let page = 1;
  el.innerHTML =
    heading(
      "แจ้งเตือน",
      "ข่าวสารและสถานะที่เกี่ยวข้องกับคำสั่งซื้อของคุณ",
      '<button class="btn ghost" id="read-all">อ่านทั้งหมดแล้ว</button>',
    ) + '<div class="card table-card" id="notification-list"></div>';
  const draw = async () => {
    const target = $("#notification-list");
    target.innerHTML = loading();
    try {
      const { rows, count } = await listNotifications(
        context.profile.customer_id,
        page,
      );
      target.innerHTML =
        (rows.length
          ? rows
              .map(
                (n) =>
                  '<article class="notification-item ' +
                  (n.read_at ? "" : "unread") +
                  '"><div><p>' +
                  esc(n.message) +
                  "</p><small>" +
                  date(n.created_at, true) +
                  '</small></div><button class="btn ghost sm" data-note="' +
                  n.notification_id +
                  '" data-order="' +
                  (n.order_id ?? "") +
                  '">' +
                  (n.order_id
                    ? "ดูคำสั่งซื้อ"
                    : n.read_at
                      ? "อ่านแล้ว"
                      : "ทำเครื่องหมายว่าอ่านแล้ว") +
                  "</button></article>",
              )
              .join("")
          : empty("ยังไม่มีการแจ้งเตือน")) +
        '<div class="pagination"><small>' +
        count +
        ' รายการ</small><div class="row"><button id="previous" ' +
        (page === 1 ? "disabled" : "") +
        ">‹</button><span>" +
        page +
        '</span><button id="next" ' +
        (page * 20 >= count ? "disabled" : "") +
        ">›</button></div></div>";
      $("#previous").onclick = () => {
        page--;
        draw();
      };
      $("#next").onclick = () => {
        page++;
        draw();
      };
      target.querySelectorAll("[data-note]").forEach(
        (b) =>
          (b.onclick = async () => {
            b.disabled = true;
            try {
              await markRead(b.dataset.note);
              await refreshUnread(context.profile);
              if (b.dataset.order)
                location.href = orderUrl("order", b.dataset.order);
              else await draw();
            } catch (error) {
              b.disabled = false;
              toast(errorMessage(error), "error");
            }
          }),
      );
    } catch (error) {
      target.replaceChildren(errorState(error, draw));
    }
  };
  $("#read-all").onclick = async () => {
    const b = $("#read-all");
    b.disabled = true;
    try {
      await markRead(null);
      await refreshUnread(context.profile);
      await draw();
      toast("ทำเครื่องหมายว่าอ่านแล้ว");
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      b.disabled = false;
    }
  };
  await draw();
}
