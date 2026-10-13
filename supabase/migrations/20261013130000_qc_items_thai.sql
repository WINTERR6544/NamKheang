-- QC checklist in Thai and English: a Thai name, what to check (Thai / English) and an example of what to fix,
-- kept with each qc_items row so an admin can edit or add items in the database (no code change).
-- Adds nullable columns only: existing reads (select item_id, item_name) and inserts (item_name only) keep working.
-- Fills the three current items only where still empty. Safe to re-run.
begin;

alter table public.qc_items
  add column if not exists item_name_th   text,
  add column if not exists description_th text,
  add column if not exists description_en text,
  add column if not exists fix_example_th text;

update public.qc_items set
  item_name_th   = coalesce(item_name_th, 'ระบบทำความเย็นและการผลิตน้ำแข็ง'),
  description_th = coalesce(description_th, 'ตรวจคอมเพรสเซอร์ น้ำยาทำความเย็น อุณหภูมิ และอัตราการผลิตน้ำแข็งให้ตรงตามสเปก'),
  description_en = coalesce(description_en, 'Check the compressor, refrigerant, temperature and ice output against the spec.'),
  fix_example_th = coalesce(fix_example_th, 'เช่น ผลิตน้ำแข็งได้ 380 กก./วัน ต่ำกว่าสเปก 500 กก./วัน ต้องเติมน้ำยาและทดสอบใหม่ 24 ชม.')
 where item_name = 'Cooling system and ice production';
update public.qc_items set
  item_name_th   = coalesce(item_name_th, 'ระบบไฟฟ้าและความปลอดภัย'),
  description_th = coalesce(description_th, 'ตรวจสายไฟ การต่อสายดิน เบรกเกอร์ และระบบตัดไฟอัตโนมัติ'),
  description_en = coalesce(description_en, 'Check the wiring, grounding, breakers and automatic cut-off.'),
  fix_example_th = coalesce(fix_example_th, 'เช่น สายดินด้านหลังตู้ควบคุมหลวม ต้องขันใหม่และวัดค่าความต้านทานซ้ำ')
 where item_name = 'Electrical system and safety';
update public.qc_items set
  item_name_th   = coalesce(item_name_th, 'รูปลักษณ์และการประกอบ'),
  description_th = coalesce(description_th, 'ตรวจตัวเครื่อง รอยบุบหรือรอยขีดข่วน น็อตยึด และท่อน้ำเข้า-ออก'),
  description_en = coalesce(description_en, 'Check the body for dents or scratches, the fasteners and the water inlet / outlet pipes.'),
  fix_example_th = coalesce(fix_example_th, 'เช่น ข้อต่อท่อน้ำเข้าด้านหลังมีน้ำซึม ต้องเปลี่ยนซีลและทดสอบแรงดัน 30 นาที')
 where item_name = 'Appearance and assembly';

commit;
