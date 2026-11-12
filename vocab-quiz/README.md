# Crescent quiz backend (Cloudflare Workers + D1)

Classroom quiz server for Crescent: sessions with QR join, students join by picking their four ID
words and a check symbol (no typing), class-restricted quizzes, restricted or full keyboard with retry until
time runs out, server-side marking, CSV export, and automatic deletion of quiz results 30 days after
each quiz. Student names never go to the server: IDs are created and results are named with an
offline tool on the administrator's computer.

Live site: https://quiz.crescent-vocab.workers.dev (admin: /admin)

## How IDs work
- An ID is four words, one from each of four word lists, always in that order — 65,536 possible IDs.
  Lists: `public/idwords.js` (each list has 16 words with different first letters; pictures are stored
  but not shown).
- Each ID slip also shows a **check symbol** (one of 8 coloured shapes) calculated from the four words.
- Students tap the four words (words only, ← もどる to go back), then tap their check symbol on the
  confirmation screen. A wrong word almost always gives a different symbol, so the mistake is caught
  before joining. The phone remembers the last ID used.
- Within a class, any two IDs differ in at least two words, so a single wrong tap never gives a
  classmate's ID; the server refuses it.
- Each quiz is open only to the classes ticked when it is started; an ID from another class is refused.

## Offline roster tool: `tools/crescent-roster-tool.html`
Double-click to open it in a browser. It is blocked from making any network connection.
1. **Create IDs:** in /admin → Student IDs, download the current ID list. In the tool, choose the class
   roster (CSV with column names in the first row), the ID list and a class label → Create IDs, then
   ① download the roster with IDs (keep it; never upload or commit it), ② download the IDs file and
   upload it in /admin, ③ print ID slips (words and check symbol) for students.
2. **Name results:** download a quiz's CSV or Item CSV from /admin; in the tool, choose it and the
   roster(s) with IDs → named file (absent students listed).

## First-time setup (Mac)
1. Node.js v22.12 or later (`node -v`; install the LTS from nodejs.org if needed).
2. `cd ~/vocab-quiz` then `npm install`
3. `npx wrangler login`
4. `npm run setup` (creates the database, tables, deploys and sets the admin key; save the key)

## Updating
- Code changes: `npm run deploy`
- Database changes ship as files in `migrations/`; run each once (e.g. `npm run db:migrate`).
- If the word lists change: `npm run build:tool` to rebuild the offline tool.

## What is stored on the server
- Item bank (sentences, answers, Japanese cues)
- Four-word IDs and class labels (no names, numbers or emails)
- Quizzes, attempts and answers (including number of tries per item) — deleted nightly once 30 days
  old (cron 03:00 JST). D1's point-in-time recovery keeps a 7-day history on the free plan, so deleted
  rows are unrecoverable after roughly 37 days.

## Quiz behaviour
- Restricted keyboard shows at least 8 keys (answer letters plus at least 3 common distractors).
- A wrong answer shakes and shows 「ちがいます。もう一度！」; students can retry until the timer ends.
  The phone checks answers against a per-student hash; marking is still done on the server.
- Results screen has a 終了 button that closes the tab where the browser allows it and otherwise
  clears the results and asks the student to close the tab.

## Files
- `src/worker.js` — API, marking, CSV, deletion cron
- `schema.sql` — tables (new installs); `migrations/` — updates for existing databases
- `public/quiz.html`, `public/idwords.js` — student quiz page and ID word lists
- `public/admin.html`, `public/admin.js` — admin console
- `public/qrcode.js` — QR library (qrcode-generator, MIT licence)
- `tools/crescent-roster-tool.html` — offline ID and name-matching tool (built from
  `tools/roster-tool.template.html` by `tools/build-tool.mjs`)
- `setup.mjs` — one-time setup script

## Local testing
```
echo 'ADMIN_KEY=test' > .dev.vars
npx wrangler d1 execute vocab-quiz --local --file schema.sql
npm run dev
```
