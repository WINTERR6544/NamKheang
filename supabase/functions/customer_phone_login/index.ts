// customer_phone_login: sign a customer in with phone number + password.
// POST { phone, password } -> { access_token, refresh_token, expires_in, token_type }
// The account's email is looked up here with the service role and never sent to the browser.
// Every failure (unknown phone, wrong password, staff account) returns the same 401 so the
// endpoint can't be used to find out which phone numbers have accounts.
// Deployed with verify_jwt = false: callers use the publishable key, and the password is the check.
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const denied = () => json({ error: "INVALID_LOGIN" }, 401);

// same rule as public.customer_normalize_phone
function normalizePhone(p: string) {
  const s = String(p ?? "").replace(/[\s()-]/g, "");
  return s.startsWith("+66") ? "0" + s.slice(3) : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  let body: { phone?: string; password?: string };
  try { body = await req.json(); } catch { return json({ error: "BAD_REQUEST" }, 400); }
  const phone = normalizePhone(body.phone ?? "");
  const password = String(body.password ?? "");
  if (!/^0[0-9]{8,9}$/.test(phone) || !password || password.length > 200) return denied();

  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rows, error } = await admin
    .from("customers").select("auth_id").eq("phone", phone).not("auth_id", "is", null).limit(2);
  if (error) return json({ error: "SERVER_ERROR" }, 500);
  if (!rows || rows.length !== 1) return denied();

  const { data: u, error: ue } = await admin.auth.admin.getUserById(rows[0].auth_id);
  if (ue || !u?.user?.email) return denied();

  const anon = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error: se } = await anon.auth.signInWithPassword({ email: u.user.email, password });
  if (se || !data.session) {
    if (se?.status === 429) return json({ error: "RATE_LIMITED" }, 429);
    if (/not confirmed/i.test(se?.message ?? "")) return json({ error: "EMAIL_NOT_CONFIRMED" }, 403);
    return denied();
  }
  const s = data.session;
  return json({ access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, token_type: s.token_type });
});
