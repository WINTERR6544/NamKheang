import { normalizePhone } from "../lib.js";
export const validators = {
  required: (value, label = "ข้อมูล") =>
    String(value ?? "").trim() ? "" : "กรุณากรอก" + label,
  name: (value) =>
    String(value ?? "").trim().length >= 2 && String(value).trim().length <= 120
      ? ""
      : "กรุณากรอกชื่อ 2–120 ตัวอักษร",
  phone: (value) =>
    /^0\d{8,9}$/.test(normalizePhone(value))
      ? ""
      : "กรุณากรอกเบอร์โทรศัพท์ไทย 9–10 หลัก",
  email: (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim()) &&
    String(value).length <= 254
      ? ""
      : "รูปแบบอีเมลไม่ถูกต้อง",
  password: (value) =>
    String(value ?? "").length >= 8 && String(value).length <= 128
      ? ""
      : "รหัสผ่านต้องมี 8–128 ตัวอักษร",
  address: (value) =>
    String(value ?? "").trim().length >= 10 &&
    String(value).trim().length <= 1000
      ? ""
      : "กรุณาระบุที่อยู่ให้ครบถ้วน 10–1,000 ตัวอักษร",
  note: (value) =>
    String(value ?? "").trim().length >= 5 &&
    String(value).trim().length <= 1000
      ? ""
      : "กรุณาระบุรายละเอียด 5–1,000 ตัวอักษร",
  account: (value) =>
    /^\d{8,20}$/.test(String(value ?? "").replace(/[-\s]/g, ""))
      ? ""
      : "เลขบัญชีต้องเป็นตัวเลข 8–20 หลัก",
};
export function bindValidation(form, rules) {
  const touched = new Set();
  const fields = (name) =>
    Array.from(form.elements).filter((field) => field.name === name);
  const values = () => Object.fromEntries(new FormData(form));
  function paint(name, message) {
    const error = form.querySelector('[data-error="' + name + '"]');
    if (error) {
      error.id ||= "field-" + name + "-error";
      error.setAttribute("aria-live", "polite");
      error.textContent = message;
      error.hidden = !message;
    }
    fields(name).forEach((field) => {
      field.setAttribute("aria-invalid", String(Boolean(message)));
      if (error) field.setAttribute("aria-describedby", error.id);
    });
  }
  function check(name) {
    const field = form.elements.namedItem(name);
    const value =
      field?.type === "checkbox" ? (field.checked ? "yes" : "") : field?.value;
    const message = rules[name](value, values());
    paint(name, message);
    return !message;
  }
  for (const name of Object.keys(rules)) {
    fields(name).forEach((field) =>
      ["blur", "input", "change"].forEach((event) =>
        field.addEventListener(event, () => {
          touched.add(name);
          check(name);
          // A password edit must immediately revalidate an already-touched confirmation field.
          touched.forEach((other) => {
            if (other !== name) check(other);
          });
        }),
      ),
    );
  }
  return {
    values,
    validate() {
      Object.keys(rules).forEach((name) => touched.add(name));
      const valid = Object.keys(rules).map(check).every(Boolean);
      if (!valid) form.querySelector('[aria-invalid="true"]')?.focus();
      return valid;
    },
    error(name, message) {
      touched.add(name);
      paint(name, message);
      fields(name)[0]?.focus();
    },
  };
}
