// Manufacturing Requests > ประเมินงาน (รับผลิต / ปฏิเสธงาน). The factory picks accept or decline (with a reason),
// reviews what the shop will receive, then confirms. Calls factory_respond; the order stays at 3 until production starts.
route(/^\/requests\/(\d+)\/evaluate$/, async (el, [id]) => {
  const [a, all, fac] = await Promise.all([fetchRequest(Number(id)), fetchRequests(), fetchFactory()]);
  const o = a.orders, c = o.customers ?? {};
  setCrumbs("Manufacturing Requests", "ประเมินงาน");
  el.onclick = null;
  const back = `<a class="btn ghost" href="#/requests/${o.order_id}">${icon("arrowLeft", 16)}กลับดูรายละเอียด</a>`;
  if (a.state !== "pending") {
    el.innerHTML = `<div class="head"><div><h1>รับผลิต / ปฏิเสธงาน</h1><div class="muted">${esc(o.order_code)}</div></div>${back}</div>
      <div class="card empty">คำขอนี้ไม่ได้รอการประเมินแล้ว (${STATE[a.state][0]})</div>`;
    return;
  }
  const load = all.filter((r) => r.response === "accepted" && [3, 4, 5, 6].includes(r.orders?.status)).length;
  let choice = ["accept", "reject"].includes(hashParams().get("choice")) ? hashParams().get("choice") : null;

  el.innerHTML = `<div class="head"><div><h1>รับผลิต / ปฏิเสธงาน</h1>
      <div class="muted">${esc(o.order_code)} · ตรวจสอบผลการประเมินและยืนยันก่อนส่งให้ร้าน ICEFLOW</div></div>${back}</div>
    <div class="card steps"><ol id="steps">
      <li class="done">${icon("circleCheck")}ตรวจสอบรายละเอียด</li>${icon("chevronRight", 16)}
      <li data-s="2">เลือกผลการประเมิน</li>${icon("chevronRight", 16)}
      <li data-s="3">ตรวจสอบและยืนยันก่อนส่ง</li></ol><span class="small muted">ยังไม่ได้ส่งผลให้ร้าน</span></div>
    <div class="grid cols-eval">
      <div class="stack">
        ${summaryCard("สรุปงานที่ประเมิน", a)}
        <div class="card"><h2>ข้อกำหนดสำคัญ</h2>
          <div class="info"><div class="lbl">สเปกเครื่อง</div><div class="val">${esc(modelName(o))} · ${esc(o.capacity)}</div><div class="small muted">${esc(o.machine_type)}</div></div>
          <div class="info"><div class="lbl">สถานที่ติดตั้ง</div><div class="val">${esc(o.install_address)}</div>
            <div class="small muted">${[o.install_space && "พื้นที่: " + o.install_space, o.install_power && "ไฟฟ้า: " + o.install_power].filter(Boolean).map(esc).join(" · ") || "-"}</div></div>
          <hr><p class="small muted">ติดต่อลูกค้า: ${esc(c.name ?? "-")} ${esc(c.phone ?? "")}</p>
          <a class="btn ghost wide" href="#/requests/${o.order_id}">${icon("file", 16)}ดูรายละเอียดทั้งหมด</a>
        </div>
      </div>
      <div class="stack">
        <div class="card" id="choose"><h2>ผลการประเมินงาน</h2><div class="muted small">เลือกการดำเนินการสำหรับคำขอนี้</div>
          <label class="choice acc" data-c="accept"><input type="radio" name="c" value="accept">
            <div class="grow"><div class="row-sb"><b>รับผลิต</b><span class="pill dot sel">เลือกอยู่</span></div>
              <div class="small muted">รับงานและนำเข้าสู่แผนการผลิตของโรงงาน</div>
              ${fac?.capacity_per_month ? `<div class="small teal">งานผลิตในมือตอนนี้ ${load} / ${fac.capacity_per_month} เครื่องต่อเดือน</div>` : ""}
              <div class="small teal">วันเริ่มผลิตและวันเสร็จโดยประมาณ ระบุในขั้นตอน Production</div></div></label>
          <label class="choice rej" data-c="reject"><input type="radio" name="c" value="reject">
            <div class="grow"><div class="row-sb"><b>ปฏิเสธ</b><span class="pill dot sel">เลือกอยู่</span></div>
              <div class="small muted">ส่งคำขอกลับให้ร้านเพื่อติดต่อโรงงานอื่น</div>
              <div class="reason"><div class="lbl-b" id="rl">เหตุผลในการปฏิเสธ * <span class="muted">(จำเป็นเมื่อปฏิเสธงาน)</span></div>
                <textarea id="r" aria-labelledby="rl" rows="4" maxlength="500" placeholder="เช่น กำลังผลิตช่วงนี้เต็ม จึงไม่สามารถส่งมอบได้ทัน"></textarea>
                <div class="row-sb small"><span class="muted">เหตุผลนี้จะส่งให้ร้านเพื่อประสานงานกับลูกค้า</span><span class="teal" id="rok" hidden>กรอกเหตุผลแล้ว ✓</span></div></div></div></label>
        </div>
        <div class="card"><div class="confirm-h"><span class="tile warm">${icon("send", 20)}</span><div><h2>ยืนยันก่อนส่งผลการประเมิน</h2>
            <div class="muted small">ตรวจสอบข้อความที่จะส่งให้ร้านอีกครั้ง</div></div></div>
          <dl class="kv2"><div><dt>Order No.</dt><dd>${esc(o.order_code)}</dd></div><div><dt>ผลที่กำลังจะส่ง</dt><dd id="res"></dd></div></dl>
          <div class="quote" id="rq" hidden><div class="small muted">เหตุผลที่ร้านจะได้รับ</div><div id="rqt"></div></div>
          <p class="small muted" id="note"></p>
          <hr><div class="row-sb"><button class="btn ghost" id="edit">กลับไปแก้ไข</button><button class="btn" id="go" disabled></button></div>
        </div>
      </div>
    </div>`;

  const r = $("#r", el), go = $("#go", el);
  const reason = () => r.value.trim();
  const valid = () => choice === "accept" || (choice === "reject" && !!reason());
  const sync = () => {
    $$(".choice", el).forEach((x) => { x.classList.toggle("on", x.dataset.c === choice); $("input", x).checked = x.dataset.c === choice; });
    $("#rok", el).hidden = !reason();
    $('#steps [data-s="2"]', el).className = valid() ? "done" : "on";
    $('#steps [data-s="3"]', el).className = valid() ? "on" : "";
    $("#res", el).textContent = { accept: "รับผลิต", reject: "ปฏิเสธการผลิต" }[choice] ?? "ยังไม่ได้เลือก";
    $("#rq", el).hidden = choice !== "reject" || !reason();
    $("#rqt", el).textContent = reason();
    $("#note", el).textContent = choice === "reject"
      ? "หลังยืนยัน ร้านจะได้รับการแจ้งเตือนพร้อมเหตุผล และคำขอนี้จะไม่เข้าสู่รายการงานผลิตของโรงงาน"
      : choice === "accept" ? "หลังยืนยัน ร้านจะได้รับการแจ้งเตือน และคำขอนี้จะย้ายไปอยู่ในรายการงานผลิต (Production) ของโรงงาน"
      : "เลือกรับผลิตหรือปฏิเสธก่อน แล้วจึงยืนยันส่งผลให้ร้าน";
    go.disabled = !valid();
    go.className = "btn" + (choice === "reject" ? " red" : "");
    go.innerHTML = icon("send", 16) + (choice === "reject" ? "ยืนยันปฏิเสธและส่งให้ร้าน" : "ยืนยันรับผลิตและส่งให้ร้าน");
  };
  $$(".choice input", el).forEach((x) => (x.onchange = () => { choice = x.value; sync(); if (choice === "reject") r.focus(); }));
  r.oninput = sync;
  $("#edit", el).onclick = () => { $("#choose", el).scrollIntoView({ behavior: "smooth", block: "start" }); (choice === "reject" ? r : $(`.choice input[value="${choice ?? "accept"}"]`, el)).focus({ preventScroll: true }); };
  go.onclick = async () => {
    if (!valid()) return;
    go.disabled = true;
    try {
      await rpc("factory_respond", { p_order: o.order_id, p_accept: choice === "accept", p_reason: choice === "reject" ? reason() : null },
        choice === "accept" ? "รับผลิตแล้ว ส่งผลให้ร้านเรียบร้อย" : "ส่งผลการปฏิเสธพร้อมเหตุผลให้ร้านแล้ว");
      refreshShell();
      location.hash = "#/requests";
    } catch (e) { toast(errText(e), true); go.disabled = false; }
  };
  sync();
  if (choice === "reject") r.focus({ preventScroll: true });
});
