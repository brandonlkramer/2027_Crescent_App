// Vocab quiz backend — Cloudflare Worker + D1
// Student routes: POST /api/join, POST /api/submit
// Admin routes (Authorization: Bearer <ADMIN_KEY>): /api/admin/...
// Nightly cron: deletes sessions, attempts and responses older than RETENTION_DAYS.

const RETENTION_DAYS = 30;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
const ID_RE = /^[a-z]+(-[a-z]+){3}$/;
const MAX_ITEMS = 40;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/j/")) {
        // Short QR link: /j/CODE -> quiz page
        const code = url.pathname.slice(3).toUpperCase();
        return Response.redirect(`${url.origin}/quiz?c=${encodeURIComponent(code)}`, 302);
      }
      if (url.pathname === "/api/join" && request.method === "POST") return await join(request, env);
      if (url.pathname === "/api/submit" && request.method === "POST") return await submit(request, env);
      if (url.pathname.startsWith("/api/admin/")) {
        if (!(await isAdmin(request, env))) return json({ error: "Not authorized" }, 401);
        return await admin(request, env, url);
      }
      if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
      return env.ASSETS.fetch(request);
    } catch (e) {
      // Do not log request bodies (they contain identifiers)
      console.error("error", url.pathname, e && e.message);
      return json({ error: "Server error" }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(purgeOld(env));
  },
};

// ---------- helpers ----------
const now = () => Date.now();
function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}
async function body(request) {
  try { return await request.json(); } catch { return {}; }
}
function normId(s) {
  return String(s || "").toLowerCase().trim().replace(/[\s_.,]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function normAnswer(s) {
  return String(s || "").trim().toLowerCase();
}
function randInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function randomCode(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randInt(CODE_ALPHABET.length)];
  return s;
}
function randomToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]);
}
async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function isAdmin(request, env) {
  const h = request.headers.get("authorization") || "";
  const given = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!env.ADMIN_KEY || !given) return false;
  // Compare hashes so the comparison time does not depend on the key
  const [a, b] = await Promise.all([sha256(given), sha256(env.ADMIN_KEY)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function promptSentence(sentence, answer) {
  // Show first letter in the blank: "She o___ the window."
  return sentence.replace("___", answer.charAt(0) + "___");
}
function lettersOf(answer) {
  return [...new Set(answer.toLowerCase().replace(/[^a-z]/g, "").split(""))].sort().join("");
}
function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows) {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n"; // BOM for Excel
}
function iso(ms) {
  // Japan time, e.g. 2026-11-10 22:45:14
  return ms ? new Date(ms + 9 * 3600000).toISOString().replace("T", " ").slice(0, 19) : "";
}

// ---------- quiz assembly ----------
async function buildQuiz(env, s) {
  const nNewWanted = s.week === 1 ? s.n_items : Math.round(s.n_items * s.new_ratio);
  const newHw = (await env.DB.prepare(
    "SELECT DISTINCT headword FROM items WHERE week = ? ORDER BY random() LIMIT ?"
  ).bind(s.week, nNewWanted).all()).results.map((r) => r.headword);

  let reviewHw = [];
  const nReviewWanted = s.n_items - newHw.length;
  if (nReviewWanted > 0 && s.week > 1) {
    reviewHw = (await env.DB.prepare(
      "SELECT DISTINCT headword FROM items WHERE week < ? AND headword NOT IN (SELECT headword FROM items WHERE week = ?) ORDER BY random() LIMIT ?"
    ).bind(s.week, s.week, nReviewWanted).all()).results.map((r) => r.headword);
  }
  // If the review pool was short, top up with more current-week words (pool-too-small handling)
  let extraHw = [];
  const short = s.n_items - newHw.length - reviewHw.length;
  if (short > 0) {
    const have = [...newHw, ...reviewHw];
    const ph = have.map(() => "?").join(",") || "''";
    extraHw = (await env.DB.prepare(
      `SELECT DISTINCT headword FROM items WHERE week <= ? AND headword NOT IN (${ph}) ORDER BY random() LIMIT ?`
    ).bind(s.week, ...have, short).all()).results.map((r) => r.headword);
  }
  const headwords = shuffle([...newHw, ...reviewHw, ...extraHw]);
  if (!headwords.length) return [];

  // One random sentence item per headword
  const ph = headwords.map(() => "?").join(",");
  const rows = (await env.DB.prepare(
    `SELECT id, headword, sentence, answer, cue FROM items WHERE headword IN (${ph}) AND week <= ?`
  ).bind(...headwords, s.week).all()).results;
  const byHw = {};
  for (const r of rows) (byHw[r.headword] ||= []).push(r);
  return headwords.map((h) => byHw[h][randInt(byHw[h].length)]);
}

function itemForClient(r, keyboard) {
  const out = { id: r.id, prompt: promptSentence(r.sentence, r.answer), cue: r.cue, first: r.answer.charAt(0), len: r.answer.length };
  if (keyboard === "restricted") out.letters = lettersOf(r.answer);
  return out;
}

// ---------- student routes ----------
async function join(request, env) {
  const b = await body(request);
  const code = String(b.code || "").toUpperCase().trim();
  const identifier = normId(b.identifier);
  if (!code) return json({ error: "セッションコードがありません。" }, 400);
  if (!ID_RE.test(identifier)) return json({ error: "IDは英単語4つで入力してください。" }, 400);

  const s = await env.DB.prepare("SELECT * FROM sessions WHERE code = ?").bind(code).first();
  if (!s) return json({ error: "このクイズは見つかりません。" }, 404);
  if (s.status !== "open") return json({ error: "このクイズは終了しました。" }, 403);

  const known = await env.DB.prepare("SELECT class_label FROM identifiers WHERE identifier = ?").bind(identifier).first();
  if (!known) return json({ error: "このIDは登録されていません。つづりを確認してください。" }, 403);

  const existing = await env.DB.prepare("SELECT * FROM attempts WHERE session_id = ? AND identifier = ?").bind(s.id, identifier).first();
  if (existing) {
    // Resume only from the same device (it holds the token)
    const tok = String(b.token || "");
    if (tok && (await sha256(tok)) === existing.token_hash) {
      if (existing.submitted_at) return json({ error: "すでに提出済みです。", submitted: true }, 409);
      const ids = JSON.parse(existing.items_json);
      const ph = ids.map(() => "?").join(",");
      const rows = (await env.DB.prepare(`SELECT id, headword, sentence, answer, cue FROM items WHERE id IN (${ph})`).bind(...ids).all()).results;
      const map = Object.fromEntries(rows.map((r) => [r.id, r]));
      return json({ token: tok, seconds: s.seconds, keyboard: s.keyboard, items: ids.filter((i) => map[i]).map((i) => itemForClient(map[i], s.keyboard)) });
    }
    return json({ error: "このIDはすでに参加しています。先生に知らせてください。" }, 409);
  }

  const items = await buildQuiz(env, s);
  if (!items.length) return json({ error: "このクイズの問題がまだ登録されていません。" }, 500);
  const token = randomToken();
  try {
    await env.DB.prepare(
      "INSERT INTO attempts (session_id, identifier, token_hash, items_json, started_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(s.id, identifier, await sha256(token), JSON.stringify(items.map((i) => i.id)), now()).run();
  } catch {
    return json({ error: "このIDはすでに参加しています。先生に知らせてください。" }, 409);
  }
  return json({ token, seconds: s.seconds, keyboard: s.keyboard, items: items.map((r) => itemForClient(r, s.keyboard)) });
}

async function submit(request, env) {
  const b = await body(request);
  const token = String(b.token || "");
  if (!token) return json({ error: "Missing token" }, 400);
  const a = await env.DB.prepare(
    "SELECT a.*, s.status FROM attempts a JOIN sessions s ON s.id = a.session_id WHERE a.token_hash = ?"
  ).bind(await sha256(token)).first();
  if (!a) return json({ error: "回答を受け付けられませんでした。" }, 404);
  if (a.submitted_at) return json({ error: "すでに提出済みです。" }, 409);
  if (a.status !== "open") return json({ error: "このクイズは終了しました。" }, 403);

  const ids = JSON.parse(a.items_json);
  const ph = ids.map(() => "?").join(",");
  const rows = (await env.DB.prepare(`SELECT id, headword, sentence, answer, cue FROM items WHERE id IN (${ph})`).bind(...ids).all()).results;
  const map = Object.fromEntries(rows.map((r) => [r.id, r]));
  const given = {};
  for (const x of Array.isArray(b.answers) ? b.answers : []) if (x && typeof x.id === "string") given[x.id] = x;

  let score = 0;
  const feedback = [];
  const stmts = [];
  ids.forEach((id, pos) => {
    const it = map[id];
    if (!it) return;
    const g = given[id] || {};
    let typed = normAnswer(g.typed).slice(0, 40);
    if (typed === it.answer.charAt(0).toLowerCase()) typed = ""; // only the given letter counts as blank
    const correct = typed !== "" && typed === normAnswer(it.answer) ? 1 : 0;
    score += correct;
    const ms = Number.isFinite(g.ms) ? Math.max(0, Math.min(600000, Math.round(g.ms))) : null;
    stmts.push(env.DB.prepare(
      "INSERT INTO responses (attempt_id, position, item_id, headword, answer, typed, correct, ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(a.id, pos + 1, id, it.headword, it.answer, typed, correct, ms));
    feedback.push({ sentence: it.sentence, answer: it.answer, typed, correct: !!correct, cue: it.cue });
  });
  stmts.push(env.DB.prepare("UPDATE attempts SET submitted_at = ?, score = ? WHERE id = ? AND submitted_at IS NULL").bind(now(), score, a.id));
  await env.DB.batch(stmts);
  return json({ score, total: feedback.length, feedback });
}

// ---------- admin routes ----------
async function admin(request, env, url) {
  const p = url.pathname.replace("/api/admin", "");
  const m = request.method;

  if (p === "/check") return json({ ok: true });

  if (p === "/sessions" && m === "POST") {
    const b = await body(request);
    const week = parseInt(b.week, 10);
    const n_items = Math.min(MAX_ITEMS, Math.max(1, parseInt(b.n_items ?? 20, 10)));
    const new_ratio = Math.min(1, Math.max(0, Number(b.new_ratio ?? 0.8)));
    const keyboard = b.keyboard === "full" ? "full" : "restricted";
    const seconds = Math.min(60, Math.max(3, parseInt(b.seconds ?? 10, 10)));
    if (!(week >= 1)) return json({ error: "Week must be 1 or higher" }, 400);
    const cnt = await env.DB.prepare("SELECT COUNT(DISTINCT headword) AS n FROM items WHERE week = ?").bind(week).first();
    if (!cnt || !cnt.n) return json({ error: `No items loaded for week ${week}` }, 400);
    const pool = await env.DB.prepare("SELECT COUNT(DISTINCT headword) AS n FROM items WHERE week <= ?").bind(week).first();
    const warnings = [];
    if (pool.n < n_items) warnings.push(`Only ${pool.n} headwords available up to week ${week}; quizzes will have ${pool.n} items.`);
    for (let tries = 0; tries < 5; tries++) {
      const code = randomCode();
      try {
        const r = await env.DB.prepare(
          "INSERT INTO sessions (code, label, week, n_items, new_ratio, keyboard, seconds, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
        ).bind(code, String(b.label || "").slice(0, 80), week, n_items, new_ratio, keyboard, seconds, now()).first();
        return json({ session: r, warnings });
      } catch (e) {
        if (!String(e.message).includes("UNIQUE")) throw e;
      }
    }
    return json({ error: "Could not create a session code" }, 500);
  }

  if (p === "/sessions" && m === "GET") {
    const rows = (await env.DB.prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM attempts a WHERE a.session_id = s.id) AS joined,
              (SELECT COUNT(*) FROM attempts a WHERE a.session_id = s.id AND a.submitted_at IS NOT NULL) AS submitted
       FROM sessions s ORDER BY s.created_at DESC LIMIT 100`
    ).all()).results;
    return json({ sessions: rows, retention_days: RETENTION_DAYS });
  }

  let mm;
  if ((mm = p.match(/^\/sessions\/(\d+)\/close$/)) && m === "POST") {
    await env.DB.prepare("UPDATE sessions SET status = 'closed', closed_at = ? WHERE id = ?").bind(now(), +mm[1]).run();
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/sessions\/(\d+)\/reopen$/)) && m === "POST") {
    await env.DB.prepare("UPDATE sessions SET status = 'open', closed_at = NULL WHERE id = ?").bind(+mm[1]).run();
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/sessions\/(\d+)\/reset$/)) && m === "POST") {
    // Let one student start again (e.g. phone died). Deletes their attempt and answers.
    const b = await body(request);
    const ident = normId(b.identifier);
    const a = await env.DB.prepare("SELECT id FROM attempts WHERE session_id = ? AND identifier = ?").bind(+mm[1], ident).first();
    if (!a) return json({ error: "No attempt for that ID in this session" }, 404);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM responses WHERE attempt_id = ?").bind(a.id),
      env.DB.prepare("DELETE FROM attempts WHERE id = ?").bind(a.id),
    ]);
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/sessions\/(\d+)\/results\.csv$/)) && m === "GET") {
    const sid = +mm[1];
    const s = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(sid).first();
    if (!s) return json({ error: "Not found" }, 404);
    const detail = url.searchParams.get("detail") === "items";
    const fname = `quiz_${s.code}_week${String(s.week).padStart(2, "0")}${detail ? "_items" : ""}.csv`;
    const head = { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${fname}"`, "cache-control": "no-store" };
    if (!detail) {
      const rows = (await env.DB.prepare(
        `SELECT a.identifier, i.class_label, a.score, json_array_length(a.items_json) AS n_items, a.started_at, a.submitted_at
         FROM attempts a LEFT JOIN identifiers i ON i.identifier = a.identifier WHERE a.session_id = ? ORDER BY a.identifier`
      ).bind(sid).all()).results;
      const out = [["identifier", "class", "session_code", "label", "week", "keyboard", "seconds_per_item", "score", "n_items", "percent", "started_at_jst", "submitted_at_jst"]];
      for (const r of rows) out.push([r.identifier, r.class_label, s.code, s.label, s.week, s.keyboard, s.seconds, r.score ?? "", r.n_items,
        r.score == null ? "" : Math.round((100 * r.score) / r.n_items), iso(r.started_at), r.submitted_at ? iso(r.submitted_at) : "not submitted"]);
      return new Response(toCsv(out), { headers: head });
    }
    const rows = (await env.DB.prepare(
      `SELECT a.identifier, r.position, r.item_id, r.headword, r.answer, r.typed, r.correct, r.ms
       FROM responses r JOIN attempts a ON a.id = r.attempt_id WHERE a.session_id = ? ORDER BY a.identifier, r.position`
    ).bind(sid).all()).results;
    const out = [["identifier", "session_code", "week", "keyboard", "position", "item_id", "headword", "answer", "typed", "correct", "ms"]];
    for (const r of rows) out.push([r.identifier, s.code, s.week, s.keyboard, r.position, r.item_id, r.headword, r.answer, r.typed, r.correct, r.ms]);
    return new Response(toCsv(out), { headers: head });
  }

  if (p === "/identifiers" && m === "POST") {
    const b = await body(request);
    const list = (Array.isArray(b.identifiers) ? b.identifiers : []).map(normId);
    const bad = list.filter((x) => !ID_RE.test(x));
    if (bad.length) return json({ error: `Invalid identifiers: ${bad.slice(0, 5).join(", ")}` }, 400);
    if (list.length > 500) return json({ error: "Send at most 500 per request" }, 400);
    const label = String(b.class_label || "").slice(0, 40);
    const t = now();
    const stmts = [];
    for (let i = 0; i < list.length; i += 30) {
      const chunk = list.slice(i, i + 30);
      stmts.push(env.DB.prepare(
        `INSERT INTO identifiers (identifier, class_label, created_at) VALUES ${chunk.map(() => "(?, ?, ?)").join(",")}
         ON CONFLICT(identifier) DO UPDATE SET class_label = excluded.class_label`
      ).bind(...chunk.flatMap((x) => [x, label, t])));
    }
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true, count: list.length });
  }
  if (p === "/identifiers" && m === "GET") {
    const rows = (await env.DB.prepare("SELECT class_label, COUNT(*) AS n FROM identifiers GROUP BY class_label ORDER BY class_label").all()).results;
    const all = (await env.DB.prepare("SELECT identifier FROM identifiers").all()).results.map((r) => r.identifier);
    return json({ classes: rows, identifiers: all });
  }
  if (p === "/identifiers/delete" && m === "POST") {
    const b = await body(request);
    const list = (Array.isArray(b.identifiers) ? b.identifiers : []).map(normId).slice(0, 90);
    if (!list.length) return json({ ok: true, count: 0 });
    await env.DB.prepare(`DELETE FROM identifiers WHERE identifier IN (${list.map(() => "?").join(",")})`).bind(...list).run();
    return json({ ok: true, count: list.length });
  }

  if (p === "/items" && m === "POST") {
    // Body: { week, replace: bool, items: [{id, headword, sense_id, sentence, answer, form, cue}] } (at most 60 per request)
    const b = await body(request);
    const week = parseInt(b.week, 10);
    const items = Array.isArray(b.items) ? b.items.slice(0, 60) : [];
    if (!(week >= 1)) return json({ error: "Week must be 1 or higher" }, 400);
    for (const it of items) {
      if (!it.id || !it.headword || !it.sense_id || !it.answer || !it.cue || String(it.sentence || "").split("___").length !== 2)
        return json({ error: `Bad item: ${it.id || "(no id)"}` }, 400);
    }
    const stmts = [];
    if (b.replace) stmts.push(env.DB.prepare("DELETE FROM items WHERE week = ?").bind(week));
    for (let i = 0; i < items.length; i += 12) { // 12 rows x 8 params = 96 (< 100 bound-parameter limit)
      const chunk = items.slice(i, i + 12);
      stmts.push(env.DB.prepare(
        `INSERT OR REPLACE INTO items (id, week, headword, sense_id, sentence, answer, form, cue) VALUES ${chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(",")}`
      ).bind(...chunk.flatMap((it) => [it.id, week, it.headword, it.sense_id, it.sentence, it.answer, it.form || "", it.cue])));
    }
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true, count: items.length });
  }
  if (p === "/items" && m === "GET") {
    const rows = (await env.DB.prepare(
      "SELECT week, COUNT(DISTINCT headword) AS headwords, COUNT(DISTINCT sense_id) AS senses, COUNT(*) AS items FROM items GROUP BY week ORDER BY week"
    ).all()).results;
    return json({ weeks: rows });
  }

  if (p === "/purge" && m === "POST") {
    return json(await purgeOld(env));
  }

  return json({ error: "Not found" }, 404);
}

// ---------- retention ----------
async function purgeOld(env) {
  const cutoff = now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const r = await env.DB.batch([
    env.DB.prepare("DELETE FROM responses WHERE attempt_id IN (SELECT a.id FROM attempts a JOIN sessions s ON s.id = a.session_id WHERE s.created_at < ?)").bind(cutoff),
    env.DB.prepare("DELETE FROM attempts WHERE session_id IN (SELECT id FROM sessions WHERE created_at < ?)").bind(cutoff),
    env.DB.prepare("DELETE FROM sessions WHERE created_at < ?").bind(cutoff),
  ]);
  const deleted = r.map((x) => x.meta.changes);
  console.log("purge", deleted.join(","));
  return { responses: deleted[0], attempts: deleted[1], sessions: deleted[2] };
}
