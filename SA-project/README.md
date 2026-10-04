# SA Project: ระบบสั่งผลิตเครื่องทำน้ำแข็ง

Source: shared Claude chat (https://claude.ai/share/0e16fe06-1fd8-4ce1-8e63-af989fb535fa), Figma file JKNBpyS1vAUQkZPRkZX6FN.

## Scope
- Actors: ลูกค้า, ร้านขายเครื่องทำน้ำแข็ง (admin), โรงงาน
- System is a middleman. OUT of scope: after-sales/claims, and performing the installation or delivery. The system schedules the install date and records that the factory confirmed the install (status 9).
- Flow: UC8 -> UC1 -> UC9 -> UC2 -> UC3 -> UC4 -> UC5 -> UC6 -> UC7 (-> UC12 refund when cancelled)
- Source of truth for numbers and tables is the live database: `supabase/migrations/`.

## Use cases (15)
| UC | Name | Actor |
|----|------|-------|
| 1 | ส่งคำขอสั่งซื้อ | ลูกค้า |
| 2 | ส่งคำสั่งผลิตให้โรงงาน | ร้าน, โรงงาน |
| 3 | ติดต่อโรงงานอื่น | ร้าน, โรงงาน |
| 4 | ผลิตเครื่องทำน้ำแข็ง | โรงงาน |
| 5 | QC | ร้าน, โรงงาน |
| 6 | นัดหมายวันติดตั้ง | ร้าน, โรงงาน, ลูกค้า |
| 7 | ตรวจรับงานและชำระเงิน | ลูกค้า, ร้าน |
| 8 | สมัครสมาชิก / เข้าสู่ระบบ | ลูกค้า |
| 9 | เสนอราคาและชำระมัดจำ | ร้าน/ลูกค้า |
| 10 | ติดตามสถานะคำสั่งซื้อ | ลูกค้า |
| 11 | ยกเลิกคำสั่งซื้อ | ลูกค้า/ร้าน |
| 12 | ยืนยันการคืนมัดจำ | ร้าน |
| 13 | จัดการข้อมูลโรงงาน | ร้าน |
| 14 | ออกรายงาน | ร้าน |
| 15 | จัดการผู้ใช้และสิทธิ์ | ร้าน |

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
- Who does QC: shop or factory? (swimlane vs UC5/Figma disagree)
- Figma still has Installation and Delivery screens; delivery is out of scope.
- Catalog models and prices are sample data.
- One machine per order (no quantity).

## Next
- [x] New swimlane (done in Figma, see "Business process (ใหม่)")
- [x] Customer site (see `site/`)
- [ ] Use case diagram
- [ ] ER diagram + data dictionary
- [ ] Sequence diagrams per UC (started in Figma)
- [ ] Shop (admin) and factory sites
