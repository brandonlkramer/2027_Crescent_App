(() => {
  const $ = (id) => document.getElementById(id);
  let KEY = sessionStorage.getItem("vqAdminKey") || "";
  let sessions = [];
  let liveTimer = null;

  // Friendly, easy-to-spell NGSL content words used to build four-word IDs (about 280 words, so roughly 6 billion combinations)
  const ID_WORDS = `apple arm baby bag ball bank beach bear bed bell bike bird black blue boat body bone book box bread bridge bright brown
  bus butter cake camera car card cat chair cheese city class clean clock cloud coat coffee cold cook corner cow cup dance desk
  dinner dog door dream dress drink duck early earth east egg energy face fall farm fast field film fire fish flag floor flower
  fly food foot forest fresh friend frog fruit full game garden gift glass gold good grass green guitar hair hand happy hat heart
  hill home horse hot house ice idea island jacket juice key king kitchen lake lamp leaf light lion long lunch map market milk
  moon morning mountain mouse music name nature new night north ocean orange page paint paper park party pen pencil pet phone
  piano picture pink plane plant plate pocket point pool quick quiet rabbit rain red rice river road rock room rose round salt
  sand school sea seat shirt shoe shop short silver simple sing sky sleep small smile snow soft song soup south space speed
  spring square star station stone store storm story street strong sugar summer sun sweet table tea teacher tent test tiger
  time toy train tree trip truck warm watch water wave west wheel white wind window winter wood world yellow young zoo
  autumn bean boot brush candle chalk cloth coin cotton crown drum engine fan feather fence fork gate glove honey kite ladder
  lemon letter lock metal nest note nurse onion oven pan pepper pie pillow pipe pizza potato radio ring roof rope ruler sail
  salad shell ship shower skirt sock spoon stamp tooth towel tower van wall wing`.trim().split(/\s+/);

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
    if (b.dataset.t === "results") loadSessions();
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
      tr.innerHTML = `<td><b>${s.code}</b><div class="muted">${date}</div></td><td>${esc(s.label || "")}</td><td>${s.week}</td><td>${s.keyboard}</td>
        <td>${s.joined} / ${s.submitted}</td><td><span class="pill ${s.status}">${s.status}</span></td><td class="row"></td>`;
      const cell = tr.lastElementChild;
      if (s.status === "open") { cell.append(btn("QR", () => showQr(s), "sec"), btn("Close", () => closeSession(s.id), "danger")); }
      else cell.append(btn("Reopen", () => api(`/sessions/${s.id}/reopen`, { method: "POST" }).then(loadSessions), "sec"));
      cell.append(btn("CSV", () => dlResults(s, false), "sec"), btn("Item CSV", () => dlResults(s, true), "sec"),
        btn("Reset a student", () => resetStudent(s), "sec"));
      tb.appendChild(tr);
    }
    const sel = $("resSession"); const keep = sel.value; sel.innerHTML = "";
    for (const s of sessions) { const o = document.createElement("option"); o.value = s.id; o.textContent = `${s.code} — week ${s.week} ${s.label ? "— " + s.label : ""} (${s.submitted} submitted)`; sel.appendChild(o); }
    if (keep) sel.value = keep;
  }
  function btn(text, fn, cls) { const b = document.createElement("button"); b.className = "btn " + (cls || ""); b.textContent = text; b.onclick = fn; return b; }
  function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
  $("refreshBtn").onclick = loadSessions;

  $("createBtn").onclick = async () => {
    try {
      const d = await api("/sessions", { method: "POST", body: JSON.stringify({
        week: +$("sWeek").value, n_items: +$("sN").value, new_ratio: +$("sRatio").value,
        keyboard: $("sKb").value, seconds: +$("sSec").value, label: $("sLabel").value }) });
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

  // ---------- named results (roster never leaves the browser) ----------
  async function named(items) {
    const f = $("rosterFile").files[0];
    const s = sessions.find((x) => String(x.id) === $("resSession").value);
    if (!f || !s) { msg($("namedMsg"), "Choose a roster file and a quiz.", "err"); return; }
    const roster = parseCsv(await readFile(f));
    const rh = roster[0].map((h) => h.trim().toLowerCase());
    const idCol = rh.indexOf("identifier");
    if (idCol < 0) { msg($("namedMsg"), "The roster has no 'identifier' column.", "err"); return; }
    const byId = new Map(roster.slice(1).map((r) => [normId(r[idCol]), r]));
    const res = parseCsv(await resultsText(s, items));
    const head = res[0];
    const out = [[...roster[0], ...head.slice(1)]];
    const seen = new Set();
    for (const r of res.slice(1)) {
      const p = byId.get(normId(r[0]));
      seen.add(normId(r[0]));
      out.push([...(p || roster[0].map((_, i) => (i === idCol ? r[0] : "(not in roster)"))), ...r.slice(1)]);
    }
    if (!items) for (const [id, p] of byId) if (!seen.has(id)) out.push([...p, ...head.slice(1).map((h) => (h === "submitted_at_jst" ? "absent" : ""))]);
    download(`named_quiz_${s.code}_week${String(s.week).padStart(2, "0")}${items ? "_items" : ""}.csv`, toCsv(out));
    const unknown = [...seen].filter((x) => !byId.has(x)).length;
    msg($("namedMsg"), `Downloaded. ${seen.size} students in results` + (unknown ? `; ${unknown} not found in this roster.` : "."), "ok");
  }
  $("namedBtn").onclick = () => named(false).catch((e) => msg($("namedMsg"), e.message, "err"));
  $("namedItemsBtn").onclick = () => named(true).catch((e) => msg($("namedMsg"), e.message, "err"));

  // ---------- IDs ----------
  async function loadIds() {
    const d = await api("/identifiers");
    const tb = $("idRows"); tb.innerHTML = "";
    for (const c of d.classes) { const tr = document.createElement("tr"); tr.innerHTML = `<td>${esc(c.class_label || "(none)")}</td><td>${c.n}</td>`; tb.appendChild(tr); }
    return new Set(d.identifiers);
  }
  function newId(taken) {
    for (let t = 0; t < 1000; t++) {
      const a = new Uint32Array(4); crypto.getRandomValues(a);
      const words = [...a].map((x) => ID_WORDS[x % ID_WORDS.length]);
      if (new Set(words).size < 4) continue;
      const id = words.join("-");
      if (!taken.has(id)) { taken.add(id); return id; }
    }
    throw new Error("Could not create a unique ID");
  }
  $("genBtn").onclick = async () => {
    try {
      const f = $("genFile").files[0];
      const label = $("genClass").value.trim();
      if (!f || !label) { msg($("genMsg"), "Choose a roster file and enter a class label.", "err"); return; }
      const rows = parseCsv(await readFile(f));
      if (rows.length < 2) { msg($("genMsg"), "The roster looks empty (the first row should be column headings).", "err"); return; }
      const head = rows[0];
      let idCol = head.map((h) => h.trim().toLowerCase()).indexOf("identifier");
      if (idCol < 0) { head.push("identifier"); idCol = head.length - 1; }
      const taken = await loadIds();
      let made = 0;
      const ids = [];
      for (const r of rows.slice(1)) {
        while (r.length < head.length) r.push("");
        if (!normId(r[idCol])) { r[idCol] = newId(taken).replace(/-/g, " "); made++; }
        ids.push(normId(r[idCol]));
      }
      download(`roster_${label.replace(/[^\w-]+/g, "_")}_with_IDs.csv`, toCsv(rows));
      for (let i = 0; i < ids.length; i += 400) await api("/identifiers", { method: "POST", body: JSON.stringify({ class_label: label, identifiers: ids.slice(i, i + 400) }) });
      await loadIds();
      msg($("genMsg"), `${made} new IDs created; ${ids.length} IDs uploaded for ${label}. Keep the downloaded roster file safe — it is the only link between names and IDs.`, "ok");
    } catch (e) { msg($("genMsg"), e.message, "err"); }
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
