# SA Project: ระบบสั่งผลิตเครื่องทำน้ำแข็ง

Source: shared Claude chat (https://claude.ai/share/0e16fe06-1fd8-4ce1-8e63-af989fb535fa), Figma file JKNBpyS1vAUQkZPRkZX6FN.

## Scope
- Actors: ลูกค้า, ร้านขายเครื่องทำน้ำแข็ง (admin), โรงงาน
- System is a middleman. OUT of scope: after-sales/claims, and performing the installation or delivery. The system schedules the install date and records that the factory confirmed the install (status 9).
- Flow: UC1 -> UC2 -> UC3 -> UC4 (-> UC5 if the factory declines) -> UC6 -> UC7 -> UC8 -> UC9 -> UC10. UC11 cancels (+ UC12 refund of a verified deposit). UC13 is tracking at any step.
- Source of truth for numbers and tables is the live database: `supabase/migrations/`.

## Use cases (15)
Numbering follows the Word report (SA เครื่องทำน้ำแข็ง). Use these numbers everywhere (code comments, docs, Figma).

| UC | Name | Actor |
|----|------|-------|
| 1 | สมัครสมาชิก / เข้าสู่ระบบ | ลูกค้า |
| 2 | สร้างคำสั่งซื้อ | ลูกค้า |
| 3 | ออกใบเสนอราคาและชำระมัดจำ | ร้าน, ลูกค้า |
| 4 | ส่งคำสั่งผลิตให้โรงงาน | ร้าน, โรงงาน |
| 5 | เลือกโรงงานใหม่ | ร้าน, โรงงาน |
| 6 | เริ่มผลิตและแจ้งผลิตเสร็จ | โรงงาน |
| 7 | ตรวจ QC และแก้ไขตามผล QC | โรงงาน (ร้านดูผลเท่านั้น) |
| 8 | นัดวันติดตั้ง | ร้าน, ลูกค้า, โรงงาน |
| 9 | ยืนยันติดตั้งเสร็จ (โรงงานตรวจ On-site QC ก่อน) | โรงงาน |
| 10 | ตรวจรับ ชำระยอดคงเหลือ ออกใบเสร็จ | ลูกค้า, ร้าน |
| 11 | ยกเลิกคำสั่งซื้อ | ลูกค้า, ร้าน, ระบบ (ใบเสนอราคาหมดอายุ) |
| 12 | คืนมัดจำ | ร้าน |
| 13 | ติดตามสถานะคำสั่งซื้อ | ลูกค้า |
| 14 | จัดการข้อมูลโรงงาน | ร้าน (Admin) |
| 15 | จัดการผู้ใช้และสิทธิ์ | ร้าน (Admin) |

### Old numbering (before 2026-10-10)
Older notes, the first migration comments and early commits used a different order. The reports UC was dropped (`20260930161349_remove_uc15_report_view`) and UC9 (confirm install) was added.

| Old | Name | New |
|---|---|---|
| 1 | submit order | 2 |
| 2 | send production order | 4 |
| 3 | contact another factory | 5 |
| 4 | produce | 6 |
| 5 | QC | 7 |
| 6 | schedule install | 8 |
| 7 | accept and pay | 10 |
| 8 | register / log in | 1 |
| 9 | quote and deposit | 3 |
| 10 | track status | 13 |
| 11 | cancel | 11 |
| 12 | refund | 12 |
| 13 | manage factories | 14 |
| 14 | reports | removed |
| 15 | users and roles | 15 |

Comments inside already-applied migration files still use the old numbers. They are not edited, because applied migrations should stay byte-for-byte as run.

## Status codes
Match `order_statuses` in the database. Allowed moves are in `status_transitions` (enforced by a trigger).

| code | name | meaning |
|------|------|---------|
| 0 | new | customer sent the order |
| 1 | quoted | shop quoted, waiting for the customer |
| 2 | deposit_paid | deposit verified |
| 3 | waiting_factory | sent to factory, waiting for reply |
| 4 | in_process | in production |
| 5 | waiting_qc | produced, waiting for QC |
| 6 | rework | QC failed, back to factory |
| 7 | qc_passed | QC passed |
| 8 | scheduled | install date set |
| 9 | installed | factory confirmed install done |
| 10 | done | accepted and fully paid |
| 99 | cancelled | cancelled |

Every status change also inserts into `order_status_logs` and notifies the customer (`notifications`).

## Tables
customers, users, factories, machine_models (catalog), orders, order_statuses, status_transitions, order_status_logs, quotations, quotation_items, payments, factory_assignments, production_updates, qc_items, qc_results, appointments, acceptance_checks, notifications, business_rules

## Open issues
- ~~Who does QC: shop or factory?~~ Decided 2026-10-10: manufacturing QC is checked by the factory only; installation is checked by the factory again (on-site QC); after install the customer rechecks, and if there is a problem the customer contacts the shop and the shop contacts the factory. Needs a `stage` column (`production`/`onsite`) on `qc_results` and a factory-portal on-site QC step; not built yet.
- Figma still has Installation and Delivery screens; delivery is out of scope.
- Catalog models and prices are sample data.
- One machine per order (no quantity).

## Next
- [x] New swimlane (done in Figma, see "Business process (ใหม่)")
- [x] Customer site (see `customer/`)
- [x] Admin (shop) site (see `admin/`)
- [ ] Use case diagram
- [ ] ER diagram + data dictionary
- [ ] Sequence diagrams per UC (started in Figma)
- [ ] Shop (admin) and factory sites
