import {client,unwrap,customerRpc} from "./customer_supabase_client.js";
import {session} from "./customer_auth_service.js";
import {CustomerError} from "../customer_errors.js";
export async function getProfile() {
  const auth = await session();
  if(!auth) throw new CustomerError("กรุณาเข้าสู่ระบบ",{status:401});
  const result = await client().from("customers").select("customer_id,auth_id,name,phone,email,company,contact_address,is_active,created_at").eq("auth_id",auth.user.id).maybeSingle();
  if(result.error && ["42703","PGRST204"].includes(result.error.code)) {
    const basic=unwrap(await client().from("customers").select("customer_id,auth_id,name,phone,email,created_at").eq("auth_id",auth.user.id).maybeSingle());
    if(!basic) throw new CustomerError("ไม่พบข้อมูลบัญชี กรุณาติดต่อร้าน");
    return {...basic,company:"",contact_address:"",is_active:true,needsSetup:true};
  }
  const profile=unwrap(result);
  if(!profile) throw new CustomerError("ไม่พบข้อมูลบัญชี กรุณาติดต่อร้าน");
  if(!profile.is_active) throw new CustomerError("บัญชีนี้ถูกระงับ กรุณาติดต่อร้าน");
  return profile;
}
export const saveProfile = values => customerRpc("customer_update_profile_v2",{
  p_name:values.name.trim(),p_phone:values.phone,p_company:values.company?.trim()||null,p_address:values.contact_address.trim()
});

