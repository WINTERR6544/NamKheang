import { wireTable, esc } from "../lib.js";
import {
  $,
  heading,
  card,
  button,
  orderTable,
  loading,
  icon,
  errorState,
} from "../components/customer_ui.js";

import { listOrders, orderCounts } from "../services/customer_order_service.js";
import { PAGE_SIZE } from "../customer_constants.js";

export async function render(context, el) {
  const counts = await orderCounts(context.profile.customer_id);
  el.innerHTML =
    heading(
      "คำสั่งซื้อของฉัน",
      "ติดตามทุกคำสั่งซื้อ ตั้งแต่ใบเสนอราคาจนถึงส่งมอบเครื่อง",
      button("+ สร้างคำสั่งซื้อใหม่", "#/new-order"),
    ) +
    '<div class="kpis">' +
    [
      ["ทั้งหมด", counts.all, "imgClipboardList"],
      ["กำลังดำเนินการ", counts.active, "imgLoaderCircle"],
      ["ขั้นชำระเงิน", counts.payment, "imgWalletCards"],
      ["เสร็จสมบูรณ์", counts.done, "imgCircleCheck"],
    ]
      .map(
        ([label, count, asset]) =>
          '<div class="kpi"><span class="kpi-icon">' +
          icon(asset, "206:3402") +
          "</span><div><small>" +
          label +
          "</small><strong>" +
          count +
          "</strong></div></div>",
      )
      .join("") +
    "</div>" +
    '<div class="toolbar"><div class="tabs" role="group" aria-label="กรองสถานะ">' +
    [
      ["all", "ทั้งหมด"],
      ["active", "กำลังดำเนินการ"],
      ["payment", "ขั้นชำระเงิน"],
      ["done", "เสร็จสมบูรณ์"],
      ["cancelled", "ยกเลิก"],
    ]
      .map(
        ([v, t]) =>
          '<button class="tab ' +
          (v === "all" ? "on" : "") +
          '" data-group="' +
          v +
          '" aria-pressed="' +
          (v === "all") +
          '">' +
          t +
          "</button>",
      )
      .join("") +
    '</div><div class="search-tools"><input id="search" placeholder="ค้นหา Order No. / ประเภท" aria-label="ค้นหาคำสั่งซื้อ"><select id="sort" aria-label="เรียงลำดับ"><option value="latest">ล่าสุดก่อน</option><option value="oldest">เก่าสุดก่อน</option></select></div></div><div class="card table-card" id="orders-table"></div>';
  wireTable($("#orders-table"));
  let page = 1,
    group = "all",
    generation = 0,
    timer;
  context.onDispose?.(() => {
    clearTimeout(timer);
    generation++;
  });
  async function draw() {
    const token = ++generation;
    const target = $("#orders-table");
    target.innerHTML = loading();
    try {
      const result = await listOrders(context.profile.customer_id, {
        page,
        size: PAGE_SIZE,
        group,
        search: $("#search").value,
        ascending: $("#sort").value === "oldest",
      });
      if (token !== generation) return;
      const pages = Math.max(1, Math.ceil(result.count / PAGE_SIZE));
      if (page > pages) {
        page = pages;
        return draw();
      }
      target.innerHTML =
        orderTable(result.rows) +
        '<div class="pagination"><small>แสดง ' +
        result.rows.length +
        " จาก " +
        result.count +
        ' รายการ</small><div class="row"><button id="prev" aria-label="หน้าก่อน" ' +
        (page <= 1 ? "disabled" : "") +
        '>‹</button><button class="current" aria-current="page">' +
        page +
        '</button><button id="next" aria-label="หน้าถัดไป" ' +
        (page >= pages ? "disabled" : "") +
        ">›</button></div></div>";
      $("#prev").onclick = () => {
        page--;
        draw();
      };
      $("#next").onclick = () => {
        page++;
        draw();
      };
    } catch (error) {
      if (token === generation) target.replaceChildren(errorState(error, draw));
    }
  }
  el.querySelectorAll("[data-group]").forEach(
    (b) =>
      (b.onclick = () => {
        group = b.dataset.group;
        page = 1;
        el.querySelectorAll("[data-group]").forEach((t) => {
          t.classList.toggle("on", t === b);
          t.setAttribute("aria-pressed", String(t === b));
        });
        draw();
      }),
  );
  $("#search").oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      page = 1;
      draw();
    }, 300);
  };
  $("#sort").onchange = () => {
    page = 1;
    draw();
  };
  await draw();
}
