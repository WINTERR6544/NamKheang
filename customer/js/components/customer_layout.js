import {$,icon,confirm,toast} from "./customer_ui.js";
import {esc,initials} from "../customer_format.js";
import {errorMessage} from "../customer_errors.js";
import {TITLES} from "../customer_constants.js";
import {signOut} from "../services/customer_auth_service.js";
import {unreadCount} from "../services/customer_notification_service.js";
const nav=[["dashboard","หน้าหลัก","imgLayoutDashboard"],["orders","คำสั่งซื้อของฉัน","imgClipboardList"],["new-order","สร้างคำสั่งซื้อ","imgCirclePlus"],["payments","การชำระเงิน","imgCreditCard"]];
export function layout(profile,page) {
  const active=["quotation","deposit","final-payment","refund","receipt"].includes(page)?"payments":["order","appointment","acceptance","cancel-order"].includes(page)?"orders":page==="catalog"?"new-order":page;
  document.body.className="app-body";
  $("#app").innerHTML='<a class="skip-link" href="#view">ข้ามไปเนื้อหา</a><div class="shell"><aside class="sidebar" id="sidebar"><a class="brand" href="dashboard.html"><span class="brand-mark">'+icon("imgSnowflake")+'</span><span><b>ICEFLOW</b><small>ICE MACHINE FLOW</small></span></a><p class="nav-label">เมนูสำหรับลูกค้า</p><nav aria-label="เมนูหลัก">'+nav.map(([key,label,asset])=>'<a class="nav-link '+(active===key?"active":"")+'" '+(active===key?'aria-current="page"':"")+' href="'+key+'.html">'+icon(asset)+'<span>'+label+'</span></a>').join("")+'</nav><div class="sidebar-account"><a class="account" href="profile.html"><span class="avatar">'+esc(initials(profile.name))+'</span><span><b>'+esc(profile.name)+'</b><small>บัญชีลูกค้า</small></span></a><button id="logout" class="icon-btn" aria-label="ออกจากระบบ">'+icon("imgLogOut")+'</button></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumbs"><button class="icon-btn mobile-menu" id="menu" aria-label="เปิดเมนู" aria-expanded="false">☰</button><span>ICEFLOW</span>'+icon("imgChevronRight")+'<b>'+esc(TITLES[page]??"ลูกค้า")+'</b></div><div class="account-tools"><a class="icon-btn bell" href="notifications.html" aria-label="แจ้งเตือน">'+icon("imgBell")+'<span id="unread" class="notification-dot" hidden></span></a><span class="divider"></span><button class="profile-button" id="profile-button" aria-label="เปิดข้อมูลส่วนตัว"><span class="avatar">'+esc(initials(profile.name))+'</span><span class="account-copy"><b>'+esc(profile.name.split(" ")[0])+'</b><small>'+esc(profile.company||"บัญชีลูกค้า")+'</small></span>'+icon("imgChevronDown")+'</button></div></header><main id="view" tabindex="-1"></main><footer>© 2026 ICEFLOW · ระบบสั่งผลิตเครื่องทำน้ำแข็ง</footer></div></div>';
  $("#menu").onclick=()=>{const on=$("#sidebar").classList.toggle("expanded");$("#menu").setAttribute("aria-expanded",String(on));};
  $("#profile-button").onclick=()=>window.dispatchEvent(new CustomEvent("customer:profile"));
  $("#logout").onclick=async()=>{if(await confirm("ออกจากระบบ?","คุณสามารถเข้าสู่ระบบใหม่เพื่อติดตามคำสั่งซื้อได้",{label:"ออกจากระบบ"})){try{await signOut();location.replace("login.html");}catch(error){toast(errorMessage(error),"error");}}};
  refreshUnread(profile);
}
export async function refreshUnread(profile) {
  try {const count=await unreadCount(profile.customer_id);const el=$("#unread");if(el){el.hidden=!count;el.textContent=count>99?"99+":count;}}
  catch { /* Notification failure must not prevent navigation. */ }
}

