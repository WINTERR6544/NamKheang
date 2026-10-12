// Browser-only deterministic fixture. Never imported by production HTML.
(()=>{
  const cfg=window.__fixtureConfig??{};
  const saved=sessionStorage.getItem("customer-test-data");
  const user={id:"11111111-1111-4111-8111-111111111111"};
  const profile={customer_id:1,auth_id:user.id,name:"ภัทรพงศ์ มณีรัตน์",phone:"0812345678",email:"customer@example.com",company:"บริษัท ไทยไอซ์ จำกัด",contact_address:"123 ถนนลาดพร้าว กรุงเทพฯ 10230",is_active:true};
  const model={model_id:1,code:"IF-T10",name:"ICEFLOW Tube Ice 1 Ton",machine_type:"Tube ice machine",capacity:"1 ton/day",price:100000,description:"เครื่องทำน้ำแข็งสำหรับธุรกิจ",is_active:true};
  const now=new Date(),stamp=now.toISOString(),future=new Date(now.getTime()+7*86400000).toISOString();
  const statuses=[0,1,2,3,4,5,6,7,8,9,10,99];
  let data=saved?JSON.parse(saved):{
    customers:[profile],machine_models:[model,{...model,model_id:2,code:"IF-F10",name:"Flake Ice 1 Ton",machine_type:"Flake ice machine",price:120000}],
    orders:statuses.map((status,i)=>({order_id:i+1,order_code:"ORD-"+String(i+1).padStart(5,"0"),customer_id:1,model_id:1,machine_type:model.machine_type,capacity:model.capacity,install_address:profile.contact_address,install_power:"220 V",install_space:"พื้นที่ 3 × 3 เมตร",status,created_at:new Date(now.getTime()-(i+1)*86400000).toISOString(),est_finish_date:future,installed_at:status>=9&&status!==99?new Date(now.getTime()-3600000).toISOString():null,cancel_reason:status===99?"เปลี่ยนแผนธุรกิจ":null,machine_models:{name:model.name,code:model.code}})).concat([{order_id:999,order_code:"OTHER-ACCOUNT",customer_id:2,status:0,created_at:stamp}]),
    quotations:statuses.map((status,i)=>({quotation_id:i+1,order_id:i+1,status:status===1?"sent":"accepted",subtotal:100000,vat:7000,total_price:107000,deposit_amount:42800,valid_until:"2030-12-31",created_at:stamp,quotation_items:[{description:"เครื่องทำน้ำแข็ง + ติดตั้ง",amount:100000}]})),
    payments:[{payment_id:1,order_id:11,amount:42800,pay_type:"deposit",verified:true,paid_at:stamp},{payment_id:2,order_id:11,amount:64200,pay_type:"final",verified:true,receipt_no:"RC-ORD-00011",paid_at:stamp},{payment_id:3,order_id:12,amount:42800,pay_type:"refund",verified:false,refund_account:null,paid_at:stamp}],
    appointments:[{appointment_id:1,order_id:9,install_datetime:future,status:"scheduled",created_at:stamp,reschedule_count:0}],
    acceptance_checks:[],production_updates:[],
    notifications:[{notification_id:1,order_id:2,recipient_type:"customer",recipient_id:1,message:"ใบเสนอราคาพร้อมแล้ว",read_at:null,created_at:stamp}],
    business_rules:[{rule_key:"reschedule_notice_days",value:1}],
    order_status_logs:statuses.flatMap((status,i)=>[0,status].map((s,n)=>({log_id:2*i+n+1,order_id:i+1,status:s,changed_at:stamp,note:n?"อัปเดตสถานะจากร้าน":null})))
  };
  if(!saved&&cfg.empty)data.orders=[];if(!saved&&cfg.inactive)data.customers[0].is_active=false;
  if(!saved&&cfg.expired)data.quotations[1].valid_until="2000-01-01";
  if(!saved&&cfg.accepted)data.quotations[1].status="accepted";
  if(!saved&&cfg.acceptance)data.acceptance_checks=[{check_id:1,order_id:10,passed:true,note:"ตรวจรับครบถ้วน",checked_at:stamp}];
  const persist=()=>sessionStorage.setItem("customer-test-data",JSON.stringify(data));
  const savedCalls=sessionStorage.getItem("customer-test-calls");
  window.__calls=savedCalls?JSON.parse(savedCalls):[];
  const call=(value)=>{window.__calls.push(value);sessionStorage.setItem("customer-test-calls",JSON.stringify(window.__calls));};
  window.__data=data;
  let active=sessionStorage.getItem("customer-test-auth")==="no"?false:cfg.auth!==false||sessionStorage.getItem("customer-test-auth")==="yes";
  window.__fail=cfg.fail??null;
  function from(table){
    let filters=[],sorts=[],range=null,single=false,selection="",opts={};
    const q={
      select(columns,options={}){selection=columns;opts=options;return q;},
      eq(k,v){filters.push(["eq",k,v]);return q;},
      is(k,v){filters.push(["eq",k,v]);return q;},
      in(k,v){filters.push(["in",k,v]);return q;},
      not(k,op,v){filters.push(["not",k,String(v).replace(/[()]/g,"").split(",").map(Number)]);return q;},
      or(v){filters.push(["search","order_code",v]);return q;},
      order(k,v={}){sorts.push([k,v.ascending!==false]);return q;},
      range(a,b){range=[a,b];return q;},
      limit(n){range=[0,n-1];return q;},
      maybeSingle(){single=true;return q;},single(){single=true;return q;},
      then(resolve,reject){return Promise.resolve().then(()=>{
        call({table,filters,range,selection,opts});
        if(window.__fail===table)return {data:null,error:{message:"Server unavailable",status:500},status:500};
        let rows=structuredClone(data[table]??[]);
        if(table==="payments")rows=rows.map(p=>({...p,orders:data.orders.find(o=>o.order_id===p.order_id)}));
        rows=rows.filter(row=>filters.every(([op,key,value])=>{
          const val=key.split(".").reduce((o,k)=>o?.[k],row);
          if(op==="eq")return value===null?val==null:String(val)===String(value);
          if(op==="in")return value.includes(val);
          if(op==="not")return !value.includes(val);
          if(op==="search"){const term=value.match(/ilike\.%([^%]*)%/)?.[1]?.toLowerCase()??"";return String(row.order_code).toLowerCase().includes(term)||String(row.machine_type).toLowerCase().includes(term);}
          return true;
        }));
        for(const [key,asc] of sorts.toReversed())rows.sort((a,b)=>(a[key]>b[key]?1:a[key]<b[key]?-1:0)*(asc?1:-1));
        const count=rows.length;if(range)rows=rows.slice(range[0],range[1]+1);
        return {data:opts.head?null:single?rows[0]??null:rows,count,error:null,status:200};
      }).then(resolve,reject);}
    };return q;
  }
  async function rpc(name,args){
    call({rpc:name,args});if(window.__fail===name)return {data:null,error:{message:"WRONG_STATUS"},status:400};
    const order=data.orders.find(o=>o.order_id===args.p_order&&o.customer_id===1);
    if(name==="customer_create_order_v2"){const id=100;data.orders.push({...data.orders[0],order_id:id,order_code:"ORD-00100",status:0,install_address:args.p_address});persist();return {data:id,error:null};}
    if(name==="customer_confirm_quote_v2")data.quotations.find(q=>q.order_id===order.order_id).status="accepted";
    if(name==="customer_submit_payment_v2")data.payments.push({payment_id:100,order_id:order.order_id,pay_type:args.p_type,amount:args.p_amount,payment_method:args.p_method,slip_path:args.p_slip,paid_at:args.p_paid_at,verified:false});
    if(name==="customer_record_acceptance_v2"){data.acceptance_checks.push({check_id:100,order_id:order.order_id,passed:args.p_passed,note:args.p_note,checked_at:stamp});if(!args.p_passed)order.status=8;}
    if(name==="customer_cancel_order_v2"){order.status=99;order.cancel_reason=args.p_reason;}
    if(name==="customer_refund_account_v2")data.payments.find(p=>p.payment_id===args.p_payment).refund_account=args.p_account;
    if(name==="customer_read_notifications_v2")data.notifications.forEach(n=>{if(args.p_notification==null||args.p_notification===n.notification_id)n.read_at=stamp;});
    if(name==="customer_update_profile_v2")Object.assign(data.customers[0],{name:args.p_name,phone:args.p_phone,company:args.p_company,contact_address:args.p_address});
    persist();return {data:null,error:null,status:200};
  }
  window.supabase={createClient:()=>({
    from,rpc,
    auth:{
      getSession:async()=>({data:{session:active?{user,access_token:"test"}:null},error:null}),
      onAuthStateChange:callback=>{if(cfg.recovery)setTimeout(()=>callback("PASSWORD_RECOVERY"),0);return {data:{subscription:{unsubscribe(){}}}};},
      signInWithPassword:async(value)=>{call({auth:"signIn",value});active=true;sessionStorage.setItem("customer-test-auth","yes");return {data:{session:{user}},error:null};},
      signUp:async(value)=>{call({auth:"signUp",value});return cfg.duplicate?{data:null,error:{code:"23505",message:"customer_unique_phone"}}:{data:{session:null},error:null};},
      setSession:async()=>{active=true;return {data:{session:{user}},error:null};},
      signOut:async()=>{active=false;sessionStorage.setItem("customer-test-auth","no");return {data:{},error:null};},
      resetPasswordForEmail:async()=>({data:{},error:null}),
      updateUser:async()=>({data:{user},error:null})
    },
    functions:{invoke:async(name,value)=>{call({function:name,value});sessionStorage.setItem("customer-test-auth","yes");return {data:{access_token:"test",refresh_token:"test"},error:null};}},
    storage:{from:()=>({upload:async(path,file)=>{call({upload:path,size:file.size});return {data:{path},error:null};},remove:async(paths)=>{call({remove:paths});return {data:[],error:null};},createSignedUrl:async(path)=>({data:{signedUrl:"data:text/plain,slip"},error:null})})}
  })};
})();
