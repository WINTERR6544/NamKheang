// Single sign-in for every actor. Signs in once, reads the account's role, then hands the session
// to the right site and opens it:
//   users.role = factory (active, with factory_id) -> factory/
//   users.role = admin | shop (active)             -> admin/
//   no users row                                   -> customer/
// Email or phone: a phone number (customers only) goes through the Edge Function customer_phone_login,
// which finds the account on the server and returns a session; the email never reaches the browser.
// The sites keep their sessions in different places, so the session is written where each site reads it:
//   admin/ and factory/: supabase-js default key in localStorage
//   customer/: key "iceflow.customer.auth", localStorage or sessionStorage by "Remember me"
const URL_ = "https://neotkiugfgktrjyzrbji.supabase.co";
const KEY = "sb_publishable_pCpu9MDRctw7DcySKYLobA_fwBXJsUG"; // publishable key; RLS protects the data
const REMEMBER = "iceflow.customer.remember";
const DEST = { factory: "factory/", staff: "admin/", customer: "customer/index.html#/dashboard" };

const $ = (s) => document.querySelector(s);

// same rule as public.customer_normalize_phone
const normalizePhone = (p) => { const s = p.replace(/[\s()-]/g, ""); return s.startsWith("+66") ? "0" + s.slice(3) : s; };

// phone + password -> session tokens, via the Edge Function (customers only)
async function phoneSignIn(phone, password) {
  let res;
  try {
    res = await fetch(`${URL_}/functions/v1/customer_phone_login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY },
      body: JSON.stringify({ phone, password }),
    });
  } catch { throw new Error("เชื่อมต่อไม่ได้ กรุณาลองใหม่"); }
  if (res.status === 401) throw new Error("เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง");
  if (res.status === 403) throw new Error("กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
  if (res.status === 429) throw new Error("ทำรายการถี่เกินไป กรุณารอแล้วลองใหม่");
  if (res.status === 404) throw new Error("ยังเข้าสู่ระบบด้วยเบอร์โทรศัพท์ไม่ได้ กรุณาใช้อีเมล");
  if (!res.ok) throw new Error("บริการเข้าสู่ระบบขัดข้อง กรุณาลองใหม่");
  const t = await res.json();
  const { data, error } = await temp.auth.setSession({ access_token: t.access_token, refresh_token: t.refresh_token });
  if (error || !data.session) throw new Error("ข้อมูลเข้าสู่ระบบไม่ถูกต้อง");
  return data;
}

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
  if (new URLSearchParams(location.search).get("reset") === "success")
    showError("ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบอีกครั้ง");
  $("#pemail").focus();
}

$("#pform").addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");
  const id = $("#pemail").value.trim();
  const password = $("#ppass").value;
  if (!id || !password) return showError("กรุณากรอกอีเมลหรือเบอร์โทรศัพท์ และรหัสผ่าน");
  const phone = id.includes("@") ? null : normalizePhone(id);
  if (phone !== null && !/^0[0-9]{8,9}$/.test(phone)) return showError("รูปแบบอีเมลหรือเบอร์โทรศัพท์ไม่ถูกต้อง");

  busy(true);
  try {
    let data;
    if (phone) data = await phoneSignIn(phone, password);
    else {
      const r = await temp.auth.signInWithPassword({ email: id, password });
      if (r.error) {
        throw new Error(/invalid login/i.test(r.error.message) ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : /not confirmed/i.test(r.error.message) ? "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ" : r.error.message);
      }
      data = r.data;
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
