(() => {
  const $ = (id) => document.getElementById(id);
  let KEY = sessionStorage.getItem("vqAdminKey") || "";
  let sessions = [];
  let liveTimer = null;

  // ---------- auth ----------
  async function api(path, opts = {}) {
    const r = await fetch("/api/admin" + path, { ...opts, headers: { authorization: "Bearer " + KEY, "content-type": "application/json", ...(opts.headers || {}) } });
    if (r.status === 401) { signOut(); throw new Error("Not authorized"); }
    const ct = r.headers.get("content-type") || "";
    const data = ct.includes("json") ? await r.json() : await r.text();
    if (!r.ok) throw new Error((data && data.error) || r.statusText);
    return data;
  }
  async function signIn() {
    KEY = $("keyInput").value.trim() || KEY;
    try {
      await api("/check");
      sessionStorage.setItem("vqAdminKey", KEY);
      $("login").classList.add("hidden"); $("app").classList.remove("hidden");
      loadSessions(); loadItems(); loadIds();
    } catch { $("loginMsg").textContent = "Key not accepted."; }
  }
  function signOut() { sessionStorage.removeItem("vqAdminKey"); KEY = ""; $("app").classList.add("hidden"); $("login").classList.remove("hidden"); }
  $("loginBtn").onclick = signIn;
  $("keyInput").addEventListener("keydown", (e) => { if (e.key === "Enter") signIn(); });
  if (KEY) signIn();

  // ---------- tabs ----------
  for (const b of document.querySelectorAll("#tabs button")) b.onclick = () => {
    for (const x of document.querySelectorAll("#tabs button")) x.classList.toggle("on", x === b);
    for (const p of document.querySelectorAll("[data-p]")) p.classList.toggle("hidden", p.dataset.p !== b.dataset.t);
    if (b.dataset.t === "sessions") loadIds();
  };

  function msg(el, text, kind) { el.textContent = text; el.className = "msg " + (kind || ""); }

  // ---------- CSV ----------
  function parseCsv(text) {
    text = text.replace(/^﻿/, "");
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ""));
  }
  function toCsv(rows) {
    const cell = (v) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  }
  function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const readFile = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f, "utf-8"); });
  const normId = (s) => String(s || "").toLowerCase().trim().replace(/[\s_.,]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  // ---------- sessions ----------
  async function loadSessions() {
    const d = await api("/sessions");
    sessions = d.sessions;
    $("retNote").textContent = `Quiz results are deleted automatically ${d.retention_days} days after the quiz is created.`;
    const tb = $("sessRows"); tb.innerHTML = "";
    for (const s of sessions) {
      const tr = document.createElement("tr");
      const date = new Date(s.created_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
      tr.innerHTML = `<td><b>${s.code}</b><div class="muted">${date}</div></td><td>${esc(s.label || "")}<div class="muted">${esc((s.classes || "").split("\n").join(", "))}</div></td><td>${s.week}</td><td>${s.keyboard}</td>
        <td>${s.joined} / ${s.submitted}</td><td><span class="pill ${s.status}">${s.status}</span></td><td class="row"></td>`;
      const cell = tr.lastElementChild;
      if (s.status === "open") { cell.append(btn("QR", () => showQr(s), "sec"), btn("Close", () => closeSession(s.id), "danger")); }
      else cell.append(btn("Reopen", () => api(`/sessions/${s.id}/reopen`, { method: "POST" }).then(loadSessions), "sec"));
      cell.append(btn("CSV", () => dlResults(s, false), "sec"), btn("Item CSV", () => dlResults(s, true), "sec"),
        btn("Reset a student", () => resetStudent(s), "sec"));
      tb.appendChild(tr);
    }
  }
  function btn(text, fn, cls) { const b = document.createElement("button"); b.className = "btn " + (cls || ""); b.textContent = text; b.onclick = fn; return b; }
  function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
  $("refreshBtn").onclick = loadSessions;

  $("createBtn").onclick = async () => {
    try {
      const d = await api("/sessions", { method: "POST", body: JSON.stringify({
        week: +$("sWeek").value, n_items: +$("sN").value, new_ratio: +$("sRatio").value,
        keyboard: $("sKb").value, seconds: +$("sSec").value, label: $("sLabel").value,
        classes: [...document.querySelectorAll("#sClasses input:checked")].map((x) => x.value) }) });
      msg($("createMsg"), d.warnings.length ? d.warnings.join("\n") : `Started quiz ${d.session.code}.`, d.warnings.length ? "err" : "ok");
      await loadSessions();
      showQr(d.session);
    } catch (e) { msg($("createMsg"), e.message, "err"); }
  };

  function showQr(s) {
    const url = `${location.origin}/j/${s.code}`;
    const qr = qrcode(0, "M"); qr.addData(url); qr.make();
    $("qrBox").innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    $("qrCode").textContent = s.code;
    $("qrUrl").textContent = url;
    $("qrScreen").classList.remove("hidden");
    $("qrClose").onclick = async () => { if (confirm("Close this quiz? Students who have not submitted will not be able to.")) { await closeSession(s.id); hideQr(); } };
    const live = async () => {
      try { const d = await api("/sessions"); const x = d.sessions.find((y) => y.id === s.id); if (x) $("qrLive").textContent = `Joined ${x.joined} · Submitted ${x.submitted}`; } catch {}
    };
    live(); clearInterval(liveTimer); liveTimer = setInterval(live, 5000);
  }
  function hideQr() { $("qrScreen").classList.add("hidden"); clearInterval(liveTimer); loadSessions(); }
  $("qrHide").onclick = hideQr;

  async function closeSession(id) { await api(`/sessions/${id}/close`, { method: "POST" }); await loadSessions(); }
  async function resetStudent(s) {
    const ident = prompt("Four-word ID of the student who needs to start again (their answers in this quiz will be deleted):");
    if (!ident) return;
    try { await api(`/sessions/${s.id}/reset`, { method: "POST", body: JSON.stringify({ identifier: ident }) }); alert("Done. The student can join again."); loadSessions(); }
    catch (e) { alert(e.message); }
  }
  async function resultsText(s, items) { return api(`/sessions/${s.id}/results.csv${items ? "?detail=items" : ""}`); }
  async function dlResults(s, items) {
    download(`quiz_${s.code}_week${String(s.week).padStart(2, "0")}${items ? "_items" : ""}.csv`, await resultsText(s, items));
  }

  // ---------- IDs (created offline with tools/crescent-roster-tool.html) ----------
  let idData = { classes: [], identifiers: [] };
  async function loadIds() {
    idData = await api("/identifiers");
    const tb = $("idRows"); tb.innerHTML = "";
    for (const c of idData.classes) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${esc(c.class_label || "(none)")}</td><td>${c.n}</td><td></td>`;
      tr.lastElementChild.append(btn("Delete this class's IDs", async () => {
        if (!confirm(`Delete all ${c.n} IDs for ${c.class_label}? Students in this class will not be able to join quizzes until IDs are uploaded again.`)) return;
        await api("/identifiers/delete-class", { method: "POST", body: JSON.stringify({ class_label: c.class_label }) });
        loadIds();
      }, "danger"));
      tb.appendChild(tr);
    }
    // class choices when starting a quiz (keep previous ticks)
    const box = $("sClasses"); const ticked = new Set([...box.querySelectorAll("input:checked")].map((x) => x.value)); box.innerHTML = "";
    if (!idData.classes.length) box.innerHTML = '<span class="muted">No IDs uploaded yet (Student IDs tab).</span>';
    for (const c of idData.classes) {
      const l = document.createElement("label"); l.style.cssText = "display:flex;gap:6px;align-items:center;color:var(--ink);font-size:.95rem;margin:0 12px 0 0";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.value = c.class_label; cb.style.width = "auto"; cb.checked = ticked.has(c.class_label);
      l.append(cb, document.createTextNode(`${c.class_label} (${c.n})`)); box.appendChild(l);
    }
  }
  $("exportIds").onclick = async () => {
    await loadIds();
    download(`crescent_current_IDs_${new Date().toISOString().slice(0, 10)}.csv`, toCsv([["identifier", "class"], ...idData.identifiers.map((r) => [r.identifier, r.class_label])]));
  };
  $("idUpload").onclick = async () => {
    try {
      const f = $("idFile").files[0];
      if (!f) { msg($("idMsg"), "Choose the ids_….csv file from the roster tool.", "err"); return; }
      const rows = parseCsv(await readFile(f));
      const h = rows[0].map((x) => x.trim().toLowerCase());
      const ic = h.indexOf("identifier"), cc = h.indexOf("class");
      if (ic < 0 || cc < 0) { msg($("idMsg"), "The file needs 'identifier' and 'class' columns (use the ids_….csv file, not the roster).", "err"); return; }
      if (h.some((x) => /name|number|氏名|学籍/.test(x))) { msg($("idMsg"), "This file seems to contain names or student numbers. Upload only the ids_….csv file.", "err"); return; }
      const byClass = {};
      for (const r of rows.slice(1)) (byClass[r[cc].trim()] ||= []).push(normId(r[ic]));
      let n = 0;
      for (const [cls, ids] of Object.entries(byClass)) {
        for (let i = 0; i < ids.length; i += 400) { await api("/identifiers", { method: "POST", body: JSON.stringify({ class_label: cls, identifiers: ids.slice(i, i + 400) }) }); n += Math.min(400, ids.length - i); }
      }
      await loadIds();
      msg($("idMsg"), `Uploaded ${n} IDs (${Object.keys(byClass).join(", ")}).`, "ok");
    } catch (e) { msg($("idMsg"), e.message, "err"); }
  };

  // ---------- items ----------
  async function loadItems() {
    const d = await api("/items");
    const tb = $("itemRows"); tb.innerHTML = "";
    for (const w of d.weeks) { const tr = document.createElement("tr"); tr.innerHTML = `<td>${w.week}</td><td>${w.headwords}</td><td>${w.senses}</td><td>${w.items}</td>`; tb.appendChild(tr); }
  }
  $("bankFile").onchange = () => { const m = ($("bankFile").files[0]?.name || "").match(/week0*(\d+)/i); if (m) $("bankWeek").value = m[1]; };
  $("bankBtn").onclick = async () => {
    try {
      const f = $("bankFile").files[0]; const week = +$("bankWeek").value;
      if (!f || !(week >= 1)) { msg($("bankMsg"), "Choose a bank file and week.", "err"); return; }
      const bank = JSON.parse(await readFile(f));
      const items = [];
      for (const h of bank) for (const s of h.senses || []) for (const it of s.items || [])
        items.push({ id: it.id, headword: h.lemma, sense_id: s.id, sentence: it.s, answer: it.a, form: it.form, cue: it.cue });
      if (!items.length) { msg($("bankMsg"), "No items found in that file.", "err"); return; }
      for (let i = 0; i < items.length; i += 60) {
        msg($("bankMsg"), `Loading ${Math.min(i + 60, items.length)} / ${items.length}…`);
        await api("/items", { method: "POST", body: JSON.stringify({ week, replace: i === 0, items: items.slice(i, i + 60) }) });
      }
      await loadItems();
      msg($("bankMsg"), `Loaded ${items.length} items from ${bank.length} headwords for week ${week}.`, "ok");
    } catch (e) { msg($("bankMsg"), e.message, "err"); }
  };
})();
