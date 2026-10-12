/** @typedef {{customer_id:number,auth_id:string,name:string,phone:string,email:string,company?:string,contact_address?:string,is_active?:boolean,created_at:string}} CustomerProfile */
/** @typedef {{order_id:number,order_code:string,status:number,customer_id:number,model_id:number,machine_type:string,capacity:string,install_address:string,install_power?:string,install_space?:string,created_at:string,est_finish_date?:string}} CustomerOrder */
/** @typedef {{payment_id:number,order_id:number,amount:number,pay_type:'deposit'|'final'|'refund',verified:boolean,slip_path?:string,receipt_no?:string,refund_account?:string}} CustomerPayment */
/** @typedef {{quotation_id:number,status:string,total_price:number,deposit_amount:number,valid_until:string,quotation_items:Array<{description:string,amount:number}>}} CustomerQuotation */
// Runtime objects remain plain JavaScript; these interfaces support editor type checking.
export {};

