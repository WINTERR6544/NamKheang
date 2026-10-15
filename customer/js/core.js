import { $, loading, errorState, toast } from "./components/customer_ui.js";
import { layout } from "./components/customer_layout.js";
import { session, signOut } from "./services/customer_auth_service.js";
import { client } from "./services/customer_supabase_client.js";
import { getProfile } from "./services/customer_profile_service.js";
import { CustomerError } from "./customer_errors.js";
import { TITLES } from "./customer_constants.js";
import { FEATURES, AUTH_PAGES, parseRoute, routeUrl } from "./lib.js";

let started = false,
  ready = false,
  activeContext = null,
  accountId = null;
let generation = 0,
  queue = Promise.resolve();

function dispose() {
  activeContext?.dispose();
  activeContext = null;
  document
    .querySelectorAll("dialog")
    .forEach((dialog) => dialog.dispatchEvent(new Event("customer:dispose")));
}
export function navigate() {
  const token = ++generation;
  dispose();
  document.body.dataset.ready = "false";
  // Serialize renderers: an older async feature can never overwrite a newer route.
  queue = queue
    .catch(() => {})
    .then(() => (token === generation ? renderRoute(token) : undefined));
  return queue;
}
async function renderRoute(token) {
  const route = parseRoute();
  try {
    $("#app").innerHTML = loading();
    document.body.dataset.page = route.page;
    if (route.page === "index") {
      (await import("./features/customer_auth.js")).renderLanding();
      document.title = "ICEFLOW · ระบบบริการลูกค้า";
    } else if (AUTH_PAGES.includes(route.page)) {
      await (
        await import("./features/customer_auth.js")
      ).renderAuth(route.page);
    } else {
      if (!Object.hasOwn(FEATURES, route.page))
        throw new CustomerError("ไม่พบหน้าที่ต้องการ กรุณากลับเมนูหลัก", {
          status: 404,
        });
      const auth = await session();
      if (token !== generation) return;
      if (!auth) {
        location.replace("../"); // shared portal (index.html at the repo root)
        return;
      }
      const profile = await getProfile();
      if (token !== generation) return;
      accountId = profile.auth_id;
      layout(profile, route.page);
      document.title = (TITLES[route.page] || "ลูกค้า") + " · ICEFLOW";
      const cleanup = new Set();
      let disposed = false;
      const context = {
        page: route.page,
        params: route.params,
        orderId: route.orderId,
        profile,
        isCurrent: () => !disposed && token === generation,
        onDispose(callback) {
          if (disposed) callback();
          else cleanup.add(callback);
        },
        dispose() {
          disposed = true;
          for (const callback of cleanup) {
            try {
              callback();
            } catch {}
          }
          cleanup.clear();
        },
        reload: () => (context.isCurrent() ? navigate() : Promise.resolve()),
      };
      activeContext = context;
      $("#view").innerHTML = loading();
      const feature = await import(
        "./features/" + FEATURES[route.page] + ".js"
      );
      if (token !== generation) return;
      await feature.render(context, $("#view"));
      if (token === generation) window.scrollTo(0, 0);
    }
  } catch (error) {
    if (token !== generation) return;
    const target = $("#view") || $("#app");
    const state = errorState(error, navigate);
    target.replaceChildren(state);
    if (!AUTH_PAGES.includes(route.page) && route.page !== "index") {
      const leave = document.createElement("button");
      leave.className = "btn ghost";
      leave.textContent = "ออกจากระบบ / ใช้บัญชีอื่น";
      leave.onclick = async () => {
        try {
          await signOut();
          location.replace("../");
        } catch {
          toast("ออกจากระบบไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ", "error");
        }
      };
      state.append(leave);
    }
  } finally {
    if (token === generation && route.key === location.hash)
      document.body.dataset.ready = "true";
  }
}
export async function boot() {
  if (started) return;
  started = true;
  const requested = new URLSearchParams(location.search).get("customer_page");
  try {
    client().auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.setItem("iceflow.customer.recovery", "yes");
        if (ready) {
          if (parseRoute().page === "reset-password") navigate();
          else location.replace(routeUrl("reset-password"));
        }
      }
      if (ready && event === "SIGNED_OUT" && activeContext)
        location.replace("../");
      if (
        ready &&
        event === "SIGNED_IN" &&
        activeContext &&
        next?.user.id !== accountId
      )
        navigate();
    });
    // Let the SDK consume access_token/code before changing the incoming URL.
    await session();
  } catch {
    /* Public landing still works; protected/auth routes show a recoverable error. */
  }
  const recovering =
    sessionStorage.getItem("iceflow.customer.recovery") === "yes";
  if (requested || recovering || !location.hash.startsWith("#/")) {
    const url = new URL(location.href);
    url.searchParams.delete("customer_page");
    url.hash = routeUrl(recovering ? "reset-password" : requested || "index");
    history.replaceState(null, "", url.href);
  }
  ready = true;
  window.addEventListener("hashchange", navigate);
  window.addEventListener("customer:profile", async () => {
    const context = activeContext;
    if (!context?.isCurrent()) return;
    try {
      await (
        await import("./features/customer_profile.js")
      ).openProfile(context);
    } catch {
      toast("โหลดข้อมูลส่วนตัวไม่ได้ กรุณาลองใหม่", "error");
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest('a[href="#view"]')) {
      event.preventDefault();
      $("#view")?.focus();
    }
  });
  window.addEventListener("offline", () =>
    toast("อินเทอร์เน็ตขาดการเชื่อมต่อ", "error"),
  );
  await navigate();
}

// Start once when loaded by index.html.
boot();
