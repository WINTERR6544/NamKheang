/** @typedef {{payment_id:number,order_id:number,amount:number,pay_type:'deposit'|'final'|'refund',verified:boolean,slip_path?:string,receipt_no?:string,refund_account?:string}} CustomerPayment */
import { client, unwrap, customerRpc } from "./customer_supabase_client.js";
import { CustomerError } from "../customer_errors.js";
import { MAX_SLIP_BYTES, SLIP_TYPES } from "../customer_constants.js";
export async function listPayments(
  customerId,
  { page = 1, size = 20, type = "all", state = "all" } = {},
) {
  // Explicit own-customer filter in addition to RLS, including server pagination.
  let query = client()
    .from("payments")
    .select(
      "payment_id,order_id,amount,pay_type,payment_method,verified,slip_path,receipt_no,refund_account,paid_at,orders!inner(order_code,status,customer_id,machine_type)",
      { count: "exact" },
    )
    .eq("orders.customer_id", customerId);
  if (["deposit", "final", "refund"].includes(type))
    query = query.eq("pay_type", type);
  if (state === "pending" || state === "verified")
    query = query.eq("verified", state === "verified");
  const result = await query
    .order("paid_at", { ascending: false })
    .order("payment_id", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  unwrap(result);
  return { rows: result.data, count: result.count ?? 0 };
}
export async function uploadSlip(file, authId, orderId) {
  if (
    !file ||
    !SLIP_TYPES.includes(file.type) ||
    file.size > MAX_SLIP_BYTES ||
    file.size === 0
  )
    throw new CustomerError("กรุณาแนบ JPG, PNG หรือ PDF ขนาดไม่เกิน 10 MB");
  // Check the file signature as well as the declared browser MIME.
  const b = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const correct =
    file.type === "image/png"
      ? b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71
      : file.type === "image/jpeg"
        ? b[0] === 255 && b[1] === 216 && b[2] === 255
        : b[0] === 37 && b[1] === 80 && b[2] === 68 && b[3] === 70;
  if (!correct)
    throw new CustomerError(
      "ชนิดไฟล์ไม่ตรงกับเนื้อหา กรุณาเลือกไฟล์ภาพหรือ PDF จริง",
    );
  const ext = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "application/pdf": "pdf",
  }[file.type];
  const path = authId + "/" + orderId + "-" + crypto.randomUUID() + "." + ext;
  unwrap(
    await client()
      .storage.from("payment-slips")
      .upload(path, file, { contentType: file.type, upsert: false }),
  );
  return path;
}
export async function submitPayment({
  orderId,
  type,
  method,
  path,
  amount,
  paidAt,
}) {
  return customerRpc("customer_submit_payment_v2", {
    p_order: Number(orderId),
    p_type: type,
    p_method: method,
    p_slip: path,
    p_amount: Number(amount),
    p_paid_at: paidAt,
  });
}
export const saveRefundAccount = (paymentId, values) =>
  customerRpc("customer_refund_account_v2", {
    p_payment: Number(paymentId),
    p_account: JSON.stringify({
      bank: values.bank.trim(),
      name: values.account_name.trim(),
      number: values.account_number.replace(/[-\s]/g, ""),
      branch: values.branch?.trim() || "",
      phone: values.phone,
    }),
  });
export async function signedSlip(path) {
  if (!path) throw new CustomerError("ยังไม่มีหลักฐานการโอน");
  return unwrap(
    await client().storage.from("payment-slips").createSignedUrl(path, 300),
  ).signedUrl;
}
export async function discardSlip(path) {
  // SQL delete policy refuses removal once a payment references the object.
  if (path) await client().storage.from("payment-slips").remove([path]);
}
