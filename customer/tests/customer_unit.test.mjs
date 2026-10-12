import test from "node:test";
import assert from "node:assert/strict";
import {normalizePhone,validId,esc,balance,money,date} from "../js/customer_format.js";
import {validators} from "../js/components/customer_validation.js";
import {errorMessage,CustomerError} from "../js/customer_errors.js";

test("normalize Thai numbers and reject malformed identifiers",()=>{
  assert.equal(normalizePhone("+66 (81) 234-5678"),"0812345678");
  assert.equal(validators.phone("081 234 5678"),"");
  for(const bad of ["","1234","081234567890","+1 212 555 1234","081x345678"])assert.ok(validators.phone(bad));
  for(const bad of ["1);drop table orders","-1","0","1.5","9007199254740992"])assert.equal(validId(bad),false);
  assert.equal(validId("123"),true);
});
test("field validation provides useful feedback",()=>{
  assert.ok(validators.email("name@"));
  assert.equal(validators.email("name@company.co.th"),"");
  assert.ok(validators.name(" "));
  assert.ok(validators.password("1234567"));
  assert.equal(validators.account("123-456-7890"),"");
  assert.ok(validators.address("short"));
  assert.ok(validators.note("bad"));
});
test("only verified deposits reduce the balance",()=>{
  assert.equal(balance({total_price:107000},[{pay_type:"deposit",amount:42800,verified:true},{pay_type:"deposit",amount:9999,verified:false},{pay_type:"refund",amount:1000,verified:true}]),64200);
  assert.equal(balance(null,[]),0);
  assert.equal(balance({total_price:100},[{pay_type:"deposit",amount:120,verified:true}]),0);
});
test("user content is escaped in markup",()=>{
  assert.equal(esc('<img src=x onerror="alert(1)">'),"&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.ok(money(107000).includes("107,000"));
  assert.equal(date(null),"ยังไม่กำหนด");
});
test("API, constraint, network and business errors are readable",()=>{
  assert.match(errorMessage({message:"QUOTE_EXPIRED"}),/หมดอายุ/);
  assert.match(errorMessage({code:"23505",message:"customer_unique_phone"}),/เบอร์โทรศัพท์/);
  assert.match(errorMessage({status:404}),/ไม่พบ/);
  assert.match(errorMessage({status:404,code:"PGRST202",message:"Could not find the function in the schema cache"}),/ยังไม่พร้อม/);
  assert.match(errorMessage({status:500}),/ขัดข้อง/);
  assert.match(errorMessage({status:403}),/สิทธิ์/);
  assert.match(errorMessage({message:"Failed to fetch"}),/อินเทอร์เน็ต/);
  assert.equal(errorMessage(new CustomerError("ข้อความสำหรับผู้ใช้")),"ข้อความสำหรับผู้ใช้");
});
