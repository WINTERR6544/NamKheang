// Single sign-in for every actor. Signs in once, reads the account's role, then hands the session
// to the right site and opens it:
//   users.role = factory (active, with factory_id) -> factory/
//   users.role = admin | shop (active)             -> admin/
//   no users row                                   -> customer/
// The sites keep their sessions in different places, so the session is written where each site reads it:
//   admin/ and factory/: supabase-js default key in localStorage
//   customer/: key "iceflow.customer.auth", localStorage or sessionStorage by "Remember me"
const URL_ = "https://neotkiugfgktrjyzrbji.supabase.co";
const KEY = "sb_publishable_pCpu9MDRctw7DcySKYLobA_fwBXJsUG"; // publishable key; RLS protects the data
const REMEMBER = "iceflow.customer.remember";
const DEST = { factory: "factory/", staff: "admin/", customer: "customer/index.html#/dashboard" };

const $ = (s) => document.querySelector(s);

// signs in without saving anything; the session is copied to the target site afterwards
const temp = supabase.createClient(URL_, KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "iceflow.portal.tmp" },
});

// same client setup as admin/js/core.js and factory/js/core.js
const staffClient = () => supabase.createClient(URL_, KEY);

// same storage rule as customer/js/services/customer_supabase_client.js
function customerClient() {
  const chosen = () => (localStorage.getItem(REMEMBER) === "no" ? sessionStorage : localStorage);
  const storage = {
    getItem: (k) => chosen().getItem(k),
    setItem: (k, v) => {
      (chosen() === localStorage ? sessionStorage : localStorage).removeItem(k);
      chosen().setItem(k, v);
    },
    removeItem: (k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); },
  };
  return supabase.createClient(URL_, KEY, {
    auth: { storageKey: "iceflow.customer.auth", storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}

// "factory" | "staff" | "customer", or throws a message for an account that can't sign in
async function roleOf(client, authId) {
  const { data: u, error } = await client
    .from("users").select("role, factory_id, is_active").eq("auth_id", authId).maybeSingle();
  if (error) throw new Error("ตรวจสอบสิทธิ์ไม่ได้ กรุณาลองใหม่");
  if (!u) return "customer";
  if (!u.is_active) throw new Error("บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  if (u.role === "factory") {
    if (!u.factory_id) throw new Error("บัญชีโรงงานนี้ยังไม่ได้ผูกกับโรงงาน กรุณาติดต่อผู้ดูแลระบบ");
    return "factory";
  }
  if (u.role === "admin" || u.role === "shop") return "staff";
  throw new Error("บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน");
}

function showError(msg) {
  const err = $("#perr");
  err.textContent = msg;
  err.hidden = !msg;
}

function busy(on) {
  $("#pbtn").disabled = on;
  $("#pbtn").textContent = on ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ";
}

// already signed in on one of the sites: go straight there
async function resume() {
  try {
    const staff = staffClient();
    const { data: s } = await staff.auth.getSession();
    if (s.session) {
      const role = await roleOf(staff, s.session.user.id).catch(() => null);
      if (role === "factory" || role === "staff") return location.replace(DEST[role]);
    }
    const { data: c } = await customerClient().auth.getSession();
    if (c.session) return location.replace(DEST.customer);
  } catch { /* fall through to the form */ }
  $("#pstatus").hidden = true;
  $("#pform").hidden = false;
  $("#pemail").focus();
}

$("#pform").addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");
  const email = $("#pemail").value.trim();
  const password = $("#ppass").value;
  if (!email || !password) return showError("กรุณากรอกอีเมลและรหัสผ่าน");

  busy(true);
  try {
    const { data, error } = await temp.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(/invalid login/i.test(error.message) ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
        : /not confirmed/i.test(error.message) ? "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ" : error.message);
    }
    const role = await roleOf(temp, data.user.id);
    const tokens = { access_token: data.session.access_token, refresh_token: data.session.refresh_token };

    if (role === "customer") {
      localStorage.setItem(REMEMBER, $("#premember").checked ? "yes" : "no");
      const { error: se } = await customerClient().auth.setSession(tokens);
      if (se) throw se;
    } else {
      const { error: se } = await staffClient().auth.setSession(tokens);
      if (se) throw se;
    }
    location.replace(DEST[role]);
  } catch (err) {
    showError(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    busy(false);
  }
});

$("#pform").hidden = true;
$("#pstatus").hidden = false;
resume();
