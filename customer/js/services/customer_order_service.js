/** @typedef {{quotation_id:number,status:string,total_price:number,deposit_amount:number,valid_until:string,quotation_items:Array<{description:string,amount:number}>}} CustomerQuotation */
/** @typedef {{order_id:number,order_code:string,status:number,customer_id:number,model_id:number,machine_type:string,capacity:string,install_address:string,install_power?:string,install_space?:string,quantity?:number,created_at:string,est_finish_date?:string}} CustomerOrder */
import { client, unwrap, customerRpc } from "./customer_supabase_client.js";
import { CustomerError } from "../customer_errors.js";
import { validId } from "../lib.js";
const ORDER_COLUMNS =
  "order_id,order_code,customer_id,model_id,machine_type,capacity,install_address,install_power,install_space,quantity,status,created_at,est_finish_date,installed_at,cancel_reason,cancelled_at,machine_models(name,code)";
export const getCatalog = async () =>
  unwrap(
    await client()
      .from("machine_models")
      .select("model_id,code,name,machine_type,capacity,price,description")
      .eq("is_active", true)
      .order("price"),
  );
export async function listOrders(
  customerId,
  { page = 1, size = 10, search = "", group = "all", ascending = false } = {},
) {
  let q = client()
    .from("orders")
    .select(ORDER_COLUMNS, { count: "exact" })
    .eq("customer_id", customerId);
  if (group === "active") q = q.not("status", "in", "(10,99)");
  if (group === "payment") q = q.in("status", [1, 9]);
  if (group === "done") q = q.eq("status", 10);
  if (group === "cancelled") q = q.eq("status", 99);
  // Search inputs are escaped/limited to text, never inserted as raw PostgREST syntax.
  const term = search
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .slice(0, 80);
  if (term)
    q = q.or(
      "order_code.ilike.%" + term + "%,machine_type.ilike.%" + term + "%",
    );
  const result = await q
    .order("created_at", { ascending })
    .order("order_id", { ascending })
    .range((page - 1) * size, page * size - 1);
  unwrap(result);
  return { rows: result.data, count: result.count ?? 0 };
}
export async function orderCounts(customerId) {
  const groups = {
    all: null,
    active: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    payment: [1, 9],
    installation: [7, 8],
    done: [10],
  };
  return Object.fromEntries(
    await Promise.all(
      Object.entries(groups).map(async ([key, statuses]) => {
        let q = client()
          .from("orders")
          .select("order_id", { head: true, count: "exact" })
          .eq("customer_id", customerId);
        if (statuses) q = q.in("status", statuses);
        const r = await q;
        unwrap(r);
        return [key, r.count ?? 0];
      }),
    ),
  );
}
export async function getOrder(id, customerId) {
  if (!validId(id)) throw new CustomerError("เลขคำสั่งซื้อไม่ถูกต้อง");
  const o = unwrap(
    await client()
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("order_id", id)
      .eq("customer_id", customerId)
      .maybeSingle(),
  );
  if (!o) throw new CustomerError("ไม่พบคำสั่งซื้อ หรือคุณไม่มีสิทธิ์เข้าถึง");
  const query = (table, columns, sort = "created_at", ascending = true) => {
    let q = client().from(table).select(columns).eq("order_id", id);
    if (table === "notifications")
      q = q.eq("recipient_type", "customer").eq("recipient_id", customerId);
    return q
      .order(sort, { ascending })
      .order(
        {
          quotations: "quotation_id",
          acceptance_checks: "check_id",
          appointments: "appointment_id",
          order_status_logs: "log_id",
          production_updates: "update_id",
          payments: "payment_id",
          notifications: "notification_id",
        }[table],
        { ascending },
      )
      .then(unwrap);
  };
  const [
    logs,
    quotes,
    payments,
    appointments,
    acceptance,
    production,
    notifications,
  ] = await Promise.all([
    query("order_status_logs", "log_id,status,changed_at,note", "changed_at"),
    query(
      "quotations",
      "quotation_id,status,subtotal,vat,total_price,deposit_amount,valid_until,created_at,quotation_items(description,amount)",
      "created_at",
      false,
    ),
    query(
      "payments",
      "payment_id,order_id,amount,pay_type,payment_method,verified,slip_path,receipt_no,refund_account,paid_at",
      "paid_at",
    ),
    query(
      "appointments",
      "appointment_id,install_datetime,status,reschedule_count,reschedule_reason,created_at",
    ),
    query("acceptance_checks", "check_id,passed,note,checked_at", "checked_at"),
    query(
      "production_updates",
      "update_id,stage,est_finish_date,note,created_at",
    ),
    query(
      "notifications",
      "notification_id,message,read_at,created_at",
      "created_at",
      false,
    ),
  ]);
  return {
    o,
    logs,
    quote: quotes[0] ?? null,
    payments,
    appointments,
    acceptance,
    production,
    notifications,
  };
}
export const createOrder = (values) =>
  customerRpc("customer_create_order_v2", {
    p_model: Number(values.model_id),
    p_address: values.install_address.trim(),
    p_power: values.install_power?.trim() || null,
    p_space: values.install_space?.trim() || null,
    p_quantity: Number(values.quantity) || 1,
  });
export const cancelOrder = (id, reason) =>
  customerRpc("customer_cancel_order_v2", {
    p_order: Number(id),
    p_reason: reason.trim(),
  });
export const acceptQuote = (id) =>
  customerRpc("customer_confirm_quote_v2", { p_order: Number(id) });
export const submitAcceptance = (id, passed, note) =>
  customerRpc("customer_record_acceptance_v2", {
    p_order: Number(id),
    p_passed: passed,
    p_note: note?.trim() || null,
  });
export const requestReschedule = (id, date, reason) =>
  customerRpc("customer_request_reschedule_v2", {
    p_order: Number(id),
    p_preferred: date,
    p_reason: reason.trim(),
  });
export const getRules = async () =>
  Object.fromEntries(
    unwrap(await client().from("business_rules").select("rule_key,value")).map(
      (r) => [r.rule_key, Number(r.value)],
    ),
  );

export async function getRescheduleRequests(orderId, customerId) {
  if (!validId(orderId)) throw new CustomerError("เลขคำสั่งซื้อไม่ถูกต้อง");
  const result = await client()
    .from("customer_reschedule_requests")
    .select(
      "request_id,order_id,customer_id,preferred_datetime,reason,status,created_at",
    )
    .eq("order_id", Number(orderId))
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .order("request_id", { ascending: false });
  if (result.error && ["42P01", "PGRST205"].includes(result.error.code)) {
    return { rows: [], available: false };
  }
  return { rows: unwrap(result), available: true };
}
