# Vocab Quiz backend (Cloudflare Workers + D1)

Classroom quiz server for the NGSL vocabulary app: sessions with QR join, four-word ID check,
restricted or full keyboard, server-side marking, CSV export, name matching on the administrator's
computer only, and automatic deletion of quiz results 30 days after each quiz.

## First-time setup (Mac)

1. Check Node.js is installed: `node -v` (v20 or later). If not, install the LTS version from nodejs.org.
2. In Terminal, go into this folder and install:
   ```
   cd ~/vocab-quiz
   npm install
   ```
3. Connect Wrangler to your Cloudflare account (a browser window opens; click Allow):
   ```
   npx wrangler login
   ```
4. Create the database, tables and site, and set the admin key:
   ```
   npm run setup
   ```
   If asked to register a workers.dev subdomain, choose any short name. At the end it prints the
   site address and an **admin key**. Save the key in your password manager.

## First use

1. Open `https://vocab-quiz.<your-subdomain>.workers.dev/admin` and enter the admin key.
2. **Item bank** tab: load `bank_week01.json` (week 1).
3. **Student IDs** tab: choose a roster CSV (e.g. student number, name) and a class label.
   The page downloads the roster with IDs added (keep it on your computer) and uploads only the IDs.
4. **Quizzes** tab: start a quiz, project the QR code, close the quiz when everyone has finished.
5. **Named results** tab: choose the roster-with-IDs file and the quiz to download named results.
   The roster is read in the browser and never uploaded.

## Updating after code changes
```
npm run deploy
```

## What is stored on the server
- Item bank (sentences, answers, Japanese cues)
- Four-word IDs and class labels (no names, numbers or emails)
- Quizzes, attempts and answers — deleted nightly once 30 days old (cron 03:00 JST).
  D1's point-in-time recovery keeps a 7-day history on the free plan, so deleted rows are
  unrecoverable after roughly 37 days.

## Files
- `src/worker.js` — API, marking, CSV, deletion cron
- `schema.sql` — tables
- `public/quiz.html` — student quiz page
- `public/admin.html`, `public/admin.js` — admin console (QR, CSV, IDs, name matching, item upload)
- `public/qrcode.js` — QR library (qrcode-generator, MIT licence)
- `setup.mjs` — one-time setup script

## Local testing
```
echo 'ADMIN_KEY=test' > .dev.vars
npx wrangler d1 execute vocab-quiz --local --file schema.sql
npm run dev
```
