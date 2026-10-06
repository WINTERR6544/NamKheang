// Manufacturing Requests > one request (รายละเอียดคำขอผลิต). Opened from the list; leads to the accept / decline page.
route(/^\/requests\/(\d+)$/, async (el, [id]) => {
  const a = await fetchRequest(Number(id));
  const o = a.orders, c = o.customers ?? {};
  setCrumbs("Manufacturing Requests", o.order_code);
  el.onclick = null;

  const kv = (rows) => `<dl class="spec">${rows.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
  const decide = {
    pending: `<p class="small muted">ตรวจสอบสเปกเครื่อง ข้อมูลลูกค้าและหน้างาน รวมถึงกำลังผลิตของโรงงาน ก่อนส่งผลการประเมินให้ร้าน</p>
      <div class="stack-btns"><a class="btn wide" href="#/requests/${o.order_id}/evaluate?choice=accept">${icon("check")}รับผลิต</a>
      <a class="btn wide outline-red" href="#/requests/${o.order_id}/evaluate?choice=reject">${icon("x")}ปฏิเสธงาน</a></div>
      <p class="small muted">ทั้งสองรายการจะไปยังหน้ายืนยันก่อนส่งผลให้ร้าน</p>`,
    rejected: `<p>คุณปฏิเสธคำขอนี้แล้ว ร้านจะติดต่อโรงงานอื่นต่อไป</p>`,
    accepted: `<p>คุณรับผลิตคำขอนี้แล้ว งานนี้ไปต่อที่หน้า Production</p>`,
    closed: `<p>ร้านยกเลิกคำสั่งซื้อนี้แล้ว จึงไม่ต้องประเมินงาน</p>`,
  }[a.state];

  el.innerHTML = `<div class="head"><div><h1>รายละเอียดคำขอผลิต</h1>
      <div class="muted">${esc(o.order_code)} · ส่งจากร้าน ICEFLOW · ${dateTH(a.sent_at)} เวลา ${timeTH(a.sent_at)}</div></div>
      <a class="btn ghost" href="#/requests">${icon("arrowLeft", 16)}กลับรายการคำขอ</a></div>
    <div class="grid cols-main">
      <div class="stack">
        <div class="card"><h2>ข้อมูลเครื่องและสเปกการผลิต</h2><div class="muted small">รายการที่ร้านยืนยันกับลูกค้า</div>
          <div class="model"><span class="tile">${icon("snowflake", 24)}</span><div><div class="model-name">${esc(modelName(o))}</div>
            <div class="small muted">${esc(o.machine_type)}${o.machine_models?.code ? ` · รหัสรุ่น ${esc(o.machine_models.code)}` : ""}</div></div></div>
          ${kv([["ประเภทเครื่อง", esc(o.machine_type)], ["กำลังผลิต", esc(o.capacity)], ["รายละเอียดรุ่น", esc(o.machine_models?.description)]])}
        </div>
        <div class="card"><h2>ลูกค้าและสถานที่ติดตั้ง</h2><div class="muted small">ข้อมูลสำหรับประเมินการติดตั้งและความพร้อมหน้างาน</div>
          <div class="grid cols2 info">
            <div><div class="lbl">ลูกค้า</div><div class="val">${esc(c.name ?? "-")}</div></div>
            <div><div class="lbl">ช่องทางติดต่อ</div><div class="val">${esc(c.phone || "-")}</div><div class="small muted">${esc(c.email ?? "")}</div></div>
          </div><hr>
          <div class="info"><div class="lbl">สถานที่ติดตั้ง</div><div class="val">${esc(o.install_address)}</div></div>
          <div class="grid cols2 info">
            <div><div class="lbl">พื้นที่ติดตั้ง</div><div class="val">${esc(o.install_space || "-")}</div></div>
            <div><div class="lbl">ระบบไฟฟ้า</div><div class="val">${esc(o.install_power || "-")}</div></div>
          </div>
        </div>
      </div>
      <div class="stack">
        ${summaryCard("สรุปคำขอผลิต", a)}
        <div class="card"><h2>ประเมินก่อนรับงาน</h2>${decide}</div>
      </div>
    </div>`;
});
