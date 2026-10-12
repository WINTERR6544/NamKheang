import {client,unwrap,customerRpc} from "./customer_supabase_client.js";
export async function listNotifications(customerId,page=1,size=20) {
  const r=await client().from("notifications").select("notification_id,order_id,message,read_at,created_at",{count:"exact"}).eq("recipient_type","customer").eq("recipient_id",customerId).order("created_at",{ascending:false}).range((page-1)*size,page*size-1);
  unwrap(r);return {rows:r.data,count:r.count??0};
}
export async function unreadCount(customerId) {
  const r=await client().from("notifications").select("notification_id",{count:"exact",head:true}).eq("recipient_type","customer").eq("recipient_id",customerId).is("read_at",null);
  unwrap(r);return r.count??0;
}
export const markRead = id => customerRpc("customer_read_notifications_v2",{p_notification:id?Number(id):null});

