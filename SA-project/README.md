# SA Project: ระบบสั่งผลิตเครื่องทำน้ำแข็ง

Source: shared Claude chat (https://claude.ai/share/0e16fe06-1fd8-4ce1-8e63-af989fb535fa), Figma file JKNBpyS1vAUQkZPRkZX6FN.

## Scope
- Actors: ลูกค้า, ร้านขายเครื่องทำน้ำแข็ง (admin), โรงงาน
- System is a middleman. OUT of scope: after-sales/claims, installation, delivery. System only schedules the install date.
- Flow: UC8 -> UC1 -> UC9 -> UC2 -> UC3 -> UC4 -> UC5 -> UC6 -> UC7 (-> UC12 refund when cancelled)

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
| code | meaning |
|------|---------|
| 0 | new |
| 1 | waiting_factory |
| 2 | reassigned |
| 3 | in_process |
| 4 | waiting_qc |
| 5 | rework |
| 6 | pdt_done |
| 7 | scheduled |
| 10 | done (paid) |
| 11 | quoted |
| 12 | deposit_paid |
| 99 | cancelled |

(8, 9, 13 removed with installation/delivery.) Every status change also inserts into `order_status_logs`.

## Tables
customers, orders, quotations, payments, factories, qc_results, qc_items, notifications, order_status_logs, users

## Open issues
- Who does QC: shop or factory? (swimlane vs UC5/Figma disagree)
- Gap between status 7 and 10: system cannot know install happened.
- Figma still has Installation and Delivery screens (out of scope); old swimlane still has install steps and lacks quotation/deposit.
- Swimlane for the new process: empty lanes in Figma section "Business process (ใหม่)".

## Next
- [ ] Fill new swimlane
- [ ] Use case diagram
- [ ] ER diagram + data dictionary
- [ ] Sequence diagrams per UC
