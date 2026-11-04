// Profile pictures for every site (customer, admin, factory). Classic script: window.NKAvatar.
// Load after supabase-js. The picture is resized to a 256x256 square (WebP, JPEG fallback) in the
// browser, uploaded to the public bucket "avatars" under "<auth uid>/", and its URL is saved on the
// login account as user_metadata.avatar_url. Only the owner can write their folder (storage policies).
(() => {
  const SIZE = 256, BUCKET = "avatars";
  const MAX_INPUT = 10 * 1024 * 1024; // the original file; what is uploaded is far smaller

  // any image file -> square Blob, centre-cropped
  async function squareBlob(file) {
    if (!/^image\//.test(file.type)) throw new Error("กรุณาเลือกไฟล์รูปภาพ");
    if (file.size > MAX_INPUT) throw new Error("รูปใหญ่เกินไป (ไม่เกิน 10 MB)");
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, bad) => {
        const i = new Image();
        i.onload = () => ok(i); i.onerror = () => bad(new Error("เปิดรูปนี้ไม่ได้ กรุณาใช้ไฟล์ JPG หรือ PNG"));
        i.src = url;
      });
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement("canvas");
      c.width = c.height = SIZE;
      c.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
      const as = (type) => new Promise((ok) => c.toBlob(ok, type, 0.86));
      let blob = await as("image/webp");
      if (!blob || blob.type !== "image/webp") blob = await as("image/jpeg");
      if (!blob) throw new Error("แปลงรูปไม่สำเร็จ");
      return blob;
    } finally { URL.revokeObjectURL(url); }
  }

  const urlOf = (user) => user?.user_metadata?.avatar_url || "";
  const pathOf = (url) => { const m = String(url).match(/\/object\/public\/avatars\/(.+?)(\?|$)/); return m ? decodeURIComponent(m[1]) : null; };

  // the reason in plain Thai (../shared/errors-th.js), never the raw server text
  const why = (e) => (globalThis.nkErrorTH ? nkErrorTH(e, "กรุณาลองใหม่") : "กรุณาลองใหม่");

  // upload a new picture, point the account at it, then remove the old file; returns the new URL
  async function upload(client, file) {
    const blob = await squareBlob(file);
    const { data: u, error: ue } = await client.auth.getUser();
    if (ue || !u?.user) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
    const old = pathOf(urlOf(u.user));
    const path = `${u.user.id}/${Date.now()}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
    const up = await client.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
    if (up.error) throw new Error("อัปโหลดรูปไม่สำเร็จ " + why(up.error));
    const url = client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const { error } = await client.auth.updateUser({ data: { avatar_url: url } });
    if (error) { await client.storage.from(BUCKET).remove([path]); throw new Error("บันทึกรูปไม่สำเร็จ " + why(error)); }
    if (old && old !== path) await client.storage.from(BUCKET).remove([old]);
    return url;
  }

  async function remove(client) {
    const { data: u } = await client.auth.getUser();
    const old = pathOf(urlOf(u?.user));
    const { error } = await client.auth.updateUser({ data: { avatar_url: null } });
    if (error) throw new Error("ลบรูปไม่สำเร็จ " + why(error));
    if (old) await client.storage.from(BUCKET).remove([old]);
  }

  // show the picture inside initials circles (text stays for screen readers / as fallback)
  function paint(els, url) {
    for (const el of els) {
      if (!el) continue;
      el.classList.toggle("has-img", !!url);
      el.style.backgroundImage = url ? `url("${String(url).replace(/"/g, "%22")}")` : "";
    }
  }

  // "change / remove picture" buttons; onChange(url | "") after a successful change
  function picker(container, client, current, onChange, toastFn) {
    const say = toastFn || ((m) => alert(m));
    container.innerHTML = `<input type="file" accept="image/jpeg,image/png,image/webp" hidden>
      <button type="button" class="btn ghost sm nk-av-change">เปลี่ยนรูป</button>
      <button type="button" class="btn ghost sm nk-av-remove" ${current ? "" : "hidden"}>ลบรูป</button>`;
    const input = container.querySelector("input"), ch = container.querySelector(".nk-av-change"), rm = container.querySelector(".nk-av-remove");
    const busy = (on, label) => { ch.disabled = rm.disabled = on; ch.textContent = on ? label : "เปลี่ยนรูป"; };
    ch.onclick = () => input.click();
    input.onchange = async () => {
      const f = input.files[0]; input.value = "";
      if (!f) return;
      busy(true, "กำลังอัปโหลด…");
      try { const url = await upload(client, f); rm.hidden = false; onChange(url); say("เปลี่ยนรูปโปรไฟล์แล้ว"); }
      catch (e) { say(e.message, true); }
      finally { busy(false); }
    };
    rm.onclick = async () => {
      busy(true, "กำลังลบ…");
      try { await remove(client); rm.hidden = true; onChange(""); say("ลบรูปโปรไฟล์แล้ว"); }
      catch (e) { say(e.message, true); }
      finally { busy(false); }
    };
  }

  window.NKAvatar = { upload, remove, paint, picker, urlOf };
})();
