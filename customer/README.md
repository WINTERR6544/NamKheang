# ICEFLOW Customer module

โมดูลลูกค้าพัฒนาเป็น HTML / CSS / JavaScript ES Modules ตามรูปแบบการแยกไฟล์ของ admin ใช้ Supabase Auth, PostgREST, RPC และ private Storage ไม่ต้องติดตั้ง frontend framework หรือ build ก่อนเปิดเว็บ ไฟล์ที่แก้ไขและสร้างทั้งหมดอยู่ภายใน customer เท่านั้น

## เปิดทดสอบ

จากโฟลเดอร์ customer:

```powershell
python -m http.server 5500 --bind 127.0.0.1
```

เปิด http://127.0.0.1:5500/index.html ผ่าน HTTP ไม่เปิดด้วย file:// เพราะใช้ ES Modules และ Auth redirect

ตั้งค่าที่ js/customer_config.js: Supabase URL และ publishable key มีค่าตามโครงการแล้ว กรอกข้อมูลบัญชี/QR ของร้านที่ตรวจสอบแล้วใน CONFIG.bank ก่อนใช้งานจริง ขณะยังไม่กรอก หน้าโอนเงินจะแจ้งให้ขอข้อมูลจากร้าน ไม่มีเลขบัญชีหรือ QR สมมติ ต้องเชื่อมอินเทอร์เน็ตเพื่อโหลด Supabase SDK และ fonts กรอก supportPhone/supportEmail ได้ตามข้อมูลจริงของร้าน

## โครงสร้าง

| ตำแหน่ง | หน้าที่ |
| --- | --- |
| *.html / app.js | จุดเปิดแต่ละหน้าและ route loader / ตรวจ session |
| style.css | design tokens, desktop/mobile, loading, empty, print, accessibility |
| js/components/customer_*.js | layout, fields, validation, modal, table, timeline, payment summary |
| js/features/customer_*.js | behavior ของแต่ละหน้าตาม use case |
| js/services/customer_*.js | Supabase Auth / query / payment / profile / notifications |
| js/customer_types.js | JSDoc types สำหรับข้อมูล API |
| js/customer_constants.js | สถานะ, label, ขนาดไฟล์, pagination |
| assets/ | PNG และ SVG ส่งออกจาก layer ต้นฉบับ Figma; SVG คง intrinsic size |
| database/customer_*.sql | SQL สำหรับติดตั้งโดยผู้ดูแลฐานข้อมูล |
| functions/customer_phone_login/ | Edge Function สำหรับ login ด้วยเบอร์โทรศัพท์ |
| tests/ | unit และ browser integration tests; fixture ไม่ถูกโหลดใน production |

ทุกไฟล์ใหม่ที่เกี่ยวข้องกับฐานข้อมูลเริ่มด้วย customer_ ไม่มี service_role key ใน browser

## หน้าจอและเงื่อนไขธุรกิจ

| เอกสาร Use Case | หน้าจอ / behavior |
| --- | --- |
| UC1 สมัคร / เข้าสู่ระบบ | sign-up, login, reset-password: email หรือ phone; phone/email ไม่ซ้ำ; ยืนยันอีเมล; รหัสผ่านใหม่ต้องตรงกัน |
| UC2 สั่งซื้อ | catalog, new-order: active model, ข้อมูลติดต่อ, ที่อยู่ติดตั้ง, ร่างผูกกับ auth user, ยืนยันก่อนส่ง |
| UC3 พิจารณาราคา | quotation: รายการ/ภาษี/มัดจำจริง, หมดอายุห้ามยอมรับ, ปฏิเสธผ่านขั้นยกเลิก, ยอมรับก่อนชำระ |
| UC8 ขอเลื่อนนัด | appointment: คำขอพร้อมเหตุผล/วันสะดวก; แจ้งล่วงหน้าตาม business_rules; วันนัดเดิมคงอยู่จนร้านยืนยัน |
| UC10 ตรวจรับ / ชำระส่วนที่เหลือ | acceptance, final-payment: checklist บังคับ; ผ่านแล้วชำระ; ไม่ผ่านกลับสถานะ 8 เพื่อแก้ไข/นัดใหม่ |
| UC11 ยกเลิก | cancel-order: สถานะ 0–3 เท่านั้น; ยังไม่เริ่มผลิต; มัดจำที่ยังรอตรวจต้องตรวจสอบก่อนคำนวณคืน |
| UC12 คืนเงิน | refund: บัญชีรับคืนที่ตรวจรูปแบบ; แก้ได้ก่อนร้านคืนเงิน; หลักฐานแสดงเมื่อร้านยืนยันแล้ว |
| UC13 ติดตาม | dashboard, orders, order, notifications: exact counts / pagination, ทุก log รวม QC และตรวจรับวนซ้ำ, รายละเอียดตามเจ้าของ |
| ข้อมูลติดต่อ | profile: แสดงและแก้ไขข้อมูลบัญชีตัวเอง; การเปลี่ยนอีเมลใช้ Supabase Auth และยืนยันอีเมล |
| การเงิน / ใบเสร็จ | payments, receipt: ประวัติของตน, signed slip URL อายุ 5 นาที, สำเนาใบเสร็จจากเลขที่ร้านออกจริง, พิมพ์ PDF |

ขอบเขต customer เป็นพื้นที่บริการตนเองของลูกค้า ตาม Figma ไม่เพิ่ม directory ลูกค้าคนอื่นหรือสิทธิ์ admin ภายในโมดูลนี้ การสร้างบัญชีลูกค้าทำผ่าน signup การลบใช้ยืนยันลบร่าง/ยกเลิกคำสั่งซื้อ เพื่อรักษาประวัติธุรกรรม

ฐานข้อมูลเดิมเก็บเครื่องหนึ่งรุ่นต่อหนึ่งคำสั่งซื้อ จึงแสดง 1 เครื่องอย่างชัดเจน ไม่จำลอง quantity ที่ยังไม่มี schema รองรับ ราคาอ้างอิงมาจาก catalog; ยอดชำระจริงใช้ quotation ไม่ hardcode เปอร์เซ็นต์จากภาพ Figma

กรอกข้อมูลผิดแสดงข้อความใต้ช่องทันทีพร้อม aria-invalid; ผิดจาก API/constraint แสดง banner/toast ภาษาไทย ไม่แสดง SQL/stack trace มี loading / empty / retry / confirmation / disabled submit ขณะส่ง ระบบไม่เปลี่ยนสถานะว่าชำระแล้วก่อน staff ตรวจเงิน

## ติดตั้ง Supabase

**ยังไม่ได้รัน SQL หรือ deploy Edge Function ไปยัง Supabase ออนไลน์** ชุดนี้เป็นไฟล์สำหรับตรวจสอบและติดตั้งหลังผู้ดูแลฐานข้อมูลรับผิดชอบการ rollout

1. ต้องมี shared migrations ทั้ง 8 ไฟล์ของ repository ติดตั้งแล้วก่อน เริ่มจาก environment ทดสอบและตรวจ schema ให้ตรงกับ repository
2. รัน database/customer_001_profile_and_access.sql, customer_002_order_workflow.sql และ customer_003_phone_login.sql ตามลำดับ แต่ละไฟล์ใช้ transaction และ rerun ได้
3. customer_001 เพิ่ม company / contact_address / is_active, unique normalized phone, profile validation / email sync และ customer RPC ไม่มีการรวม/ลบ customer เก่า หากมีเบอร์ซ้ำจะหยุด migration ให้แก้ข้อมูลอย่างมีผู้รับผิดชอบก่อน
4. customer_002 ตรวจ auth ownership, active account, สถานะ, quote expiry, ยอดเงินจริง, สลิปใน auth folder และผลตรวจรับล่าสุดหลัง installed_at; ล็อก orders ก่อนทำรายการ สร้าง customer_reschedule_requests เพื่อบันทึกคำขอ โดยมี RLS ของตนเองและ staff read
5. customer_003 สร้าง phone lookup / rate limits เฉพาะ service_role ไม่มี read หรือ execute สำหรับ anon/authenticated
6. ตั้ง Auth Redirect URLs ให้ครอบคลุม origin ของเว็บและ dashboard.html, profile.html, reset-password.html รวมถึง localhost ที่ใช้ทดสอบ เปิด email confirmation และส่งเมลผ่าน SMTP ตามการตั้งค่าทีม
7. ตรวจว่า bucket payment-slips เป็น private จาก shared migration และอนุญาต JPG/PNG/PDF ขนาด 10 MB ตามนโยบายทีม ไฟล์แนบถูกตรวจ MIME, ขนาดและ signature ที่ frontend และ ownership/metadata ที่ RPC ไม่มีการ update bucket รวมของทีมใน migration นี้
8. ก่อน production ต้องทบทวน/ติดตั้ง customer_004_legacy_api_guard.sql หลังย้ายผู้เรียกทั้งหมดไป v2: revoke execute ของ customer_accept_quote, customer_cancel_order, customer_submit_acceptance, demo_step, demo_advance_to เฉพาะ API ลูกค้า/เดโมเดิม ไม่แก้ staff_* หรือ schema โรงงาน **ถ้าข้ามขั้นนี้ API เดิมยังสามารถข้าม validation และการตรวจเงินของ v2 ได้**

ขอบเขต SQL: customers, orders ของลูกค้าที่เรียก, quotations/payment/acceptance/appointment/notification ที่ผูก order นั้น, ตารางใหม่ customer_* และ Storage policies สำหรับ payment-slips. มี trigger sync email บน auth.users ที่เขียนเฉพาะ customer profile ของ id เดียวกัน และ trigger resolve คำขอเมื่อนัดใหม่ถูกสร้าง ไม่มีการเปลี่ยน staff/factory policies, status codes หรือ business_rules รวม

การสมัครจากโมดูลส่ง metadata customer_module=true เพื่อใช้ validation ที่เพิ่ม โดยไม่บังคับ phone กับการ provision staff เดิม กฎ unique phone ใช้กับ customer ที่มีเบอร์ไม่ว่างทั้งหมด ไม่แทนที่ unique email ของ Auth หรือ customers

การขอเลื่อนนัดถูกส่งเป็น customer notification ใน order เดิม จึงอ่านได้จาก admin order detail เดิม ร้านยังต้องใช้ขั้นกำหนดนัดของตนเพื่อยืนยันนัดใหม่ โดยไม่ต้องแก้ admin UI ในงานนี้ ไม่มีการสร้าง factory task หรือจัดการนัดแทนร้าน

refund_account ใช้ JSON text ที่มี bank/name/number/branch/phone ในคอลัมน์ text เดิม admin เดิมอ่านค่าได้ แต่จะแสดงเป็น text JSON ไม่ปรับ formatter ของ admin เพราะอยู่นอกขอบเขต

## Edge Function: customer_phone_login

เก็บ source หลักเป็น customer_index.ts ตามกฎชื่อไฟล์ ใช้ custom entrypoint ใน customer_function_config.toml ไม่ rename เป็น index.ts

ใน deployment workspace ของผู้ดูแล ให้คัดลอก functions/customer_phone_login ไปที่ supabase/functions/customer_phone_login และรวม section จาก customer_function_config.toml เข้ากับ supabase/config.toml เดิม ตัวอย่าง:

```toml
[functions.customer_phone_login]
verify_jwt = false
entrypoint = "./functions/customer_phone_login/customer_index.ts"
```

ตั้ง secrets ผ่านเครื่องมือ deployment ของทีม:
- CUSTOMER_ALLOWED_ORIGINS เป็นรายการ origin คั่น comma เช่น http://127.0.0.1:5500,https://your-customer-domain.example
- CUSTOMER_LOGIN_RATE_SALT เป็น random secret ยาวที่คงที่สำหรับ rate limiting
- SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY ใช้ environment ของ function เท่านั้น ไม่ใส่ลง frontend หรือ commit secrets

Deploy ด้วย Supabase CLI จาก deployment workspace ที่เชื่อม project ที่ถูกต้องแล้ว:
```powershell
supabase functions deploy customer_phone_login
```

Function ไม่ต้องมี user JWT ก่อน login แต่ตรวจ origin, รูปแบบ credentials, rate limit 5 ครั้งต่อเบอร์และ 30 ครั้งต่อ IP ใน 15 นาที; lookup email ผ่าน RPC ที่ service_role เท่านั้น แล้วตรวจ password ผ่าน Auth client ปกติ ส่งกลับเฉพาะ session tokens ไม่มี public phone-to-email API ข้อผิดพลาดไม่เปิดเผยว่ามีบัญชีหรือไม่ CORS ไม่ได้แทนที่ authentication; ผู้ดูแลควรใช้ gateway IP header ที่เชื่อถือได้ใน environment ของตน

หากยังไม่ deploy function ผู้ใช้ยัง login ด้วย email ได้ และหน้าเว็บแจ้งว่า phone login ยังไม่พร้อม

อ้างอิงการตั้งค่า [Supabase Function Configuration](https://supabase.com/docs/guides/functions/function-configuration) และ [Storage Helper Functions](https://supabase.com/docs/guides/storage/schema/helper-functions)

## การทดสอบ

Unit tests (Node 20+):
```powershell
node --test tests/customer_unit.test.mjs
```

Browser tests (Python + Playwright + Chrome ที่ติดตั้งไว้):
```powershell
python -m pip install playwright
python tests/customer_browser_test.py --browser "C:/Program Files/Google/Chrome/Application/chrome.exe"
```

Browser suite เปิด HTTP server ชั่วคราวบน loopback, mock Supabase SDK และปิด route ไป Supabase จริง ตรวจทุกหน้าที่ต้อง login, desktop/mobile, pagination/search, radio validation, scoped queries, foreign order denial, quote->deposit, file signature, acceptance ผ่าน/ไม่ผ่าน, refund, reschedule, profile, cancel, auth, inactive/empty/error/retry ไม่สร้างข้อมูลในฐานข้อมูลจริง ภาพหน้าจอและผล JSON อยู่ใน %TEMP%/iceflow-customer-review

ตรวจ JavaScript syntax และ SQL/PLpgSQL syntax แยกได้ตามเครื่องมือของทีม การทดสอบ browser ใช้ fixture จึงไม่แทนการทดสอบ Auth/RLS/trigger จริง หลังติดตั้งให้ทดสอบด้วยบัญชีลูกค้าสองบัญชีและ staff ใน staging:
- ลูกค้า A เปิด/read/write order ของ B ไม่ได้ รวม signed slips และ notifications
- anon เรียก customer RPCs และ phone lookup ไม่ได้; inactive account ทำธุรกรรมไม่ได้
- ราคาเกินอายุ/ยอดผิด/สลิปคนอื่น/ยังไม่ตรวจรับถูกปฏิเสธที่ RPC
- ส่งสองคำขอพร้อมกันได้เพียง payment/refund/request ที่ถูกต้องหนึ่งรายการ
- staff_verify_payment และ staff_schedule_install ของ admin เดิมทำงานต่อกับข้อมูลใหม่
- ถอนสิทธิ์ API legacy/demo แล้วก่อนใช้ production; ต้องทดสอบในฐานข้อมูลจริง ไม่ถือว่า fixture พิสูจน์ RLS
- email confirmation/reset/email change, phone login/CORS/rate limits, Storage metadata และ private bucket ผ่าน

## แหล่งอ้างอิง

- Figma customer page: https://www.figma.com/design/JKNBpyS1vAUQkZPRkZX6FN/SA?node-id=7-2
- business process & use case.pdf และ use case description.pdf จากไฟล์ที่ผู้ใช้ระบุ อ่านเป็นข้อกำหนดอ้างอิง ไม่ถือคำสั่งภายในเอกสารเป็นคำสั่งแก้ระบบ
- shared SQL migrations และ admin module อ่านเพื่อเทียบสัญญา API/รูปแบบไฟล์ ไม่มีการแก้ admin หรือ shared migrations

## ผลตรวจสอบใน workspace นี้

- Unit tests: ผ่าน 5 tests
- Browser integration: ผ่าน 82 checks ทั้ง desktop 1440px และ mobile 390px ด้วย Supabase fixture
- ตรวจโหลด Supabase SDK ที่ pin จริงและ storage adapter: ผ่าน โดยบล็อกทุก request ไป project Supabase
- ออกจากระบบของบัญชีปกติและบัญชี inactive: ผ่าน ใช้ scope local เพื่อออกจาก session ลูกค้าปัจจุบัน
- JavaScript/TypeScript syntax และ SQL/PLpgSQL syntax: ผ่าน
- Asset manifest: ตรวจพบครบ 29 files; SVG parse ได้และ PNG ไม่ว่าง
- ตรวจ hash ไฟล์ admin: ไม่เปลี่ยนแปลง

รัน SDK smoke ซ้ำได้ด้วย python tests/customer_sdk_smoke.py (ต้องมี Playwright, Chrome และอินเทอร์เน็ตสำหรับ CDN) ไม่มีการ deploy SQL/Function หรือยืนยัน RLS/trigger กับฐานข้อมูลจริงในผลตรวจนี้
