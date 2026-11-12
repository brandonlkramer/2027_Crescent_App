# Crescent (Vocabulary Study App) — Working Specification

Last updated: 2026-11-12 (v9)

## NAME AND IDENTITY
- App name: **Crescent** (クレセント). Decided 2026-11-12.
- Meaning: Kwansei Gakuin's crescent (新月) stands for growing a little each day toward the full moon; the app applies this to steady weekly vocabulary growth.
- Progress moon: the header shows a moon that starts as a thin waxing crescent and fills to a full moon as the student learns the meanings in the selected practice set (a meaning counts as learned once answered correctly in practice; stored on the phone only).
- Use an original crescent drawing, not the university's emblem or KG logo, unless the public relations office gives permission.

## VOCABULARY AND QUESTION CONTENT
- Use the New General Service List (NGSL), associated with Browne and Culligan (Creative Commons; confirmed free to use, and we are happy to share everything we build). Record the exact version and attribution wording in the app's credits. https://www.newgeneralservicelist.com/new-general-service-list
- Source files (supplied by Brandon): NGSL 1.2 lemmatized list, NGSL 1.2 definitions, and NGSL 1.2 stats (official SFI ranks, used for all numbering).
- Starting point: the programme begins at NGSL rank 500; ranks 1–499 are not taught.
- Exclude function words (articles, pronouns, prepositions, auxiliaries, conjunctions, determiners and similar) at every rank; only content words become items. From rank 500 this leaves 2,260 curriculum words (about 46 weeks at 50 per week); 50 function words were removed and 31 borderline words are flagged for a decision.
- Sensitive words (kill, drug, sex): included, with carefully chosen example sentences. Decided 2026-11-12.
- Meaning senses: build our own sense inventory from COCA rather than relying on English Central's corpus or its new sense ("semma") list. Each sense is a separate practice unit, grouped under its original NGSL headword. A sense is included when it covers roughly 10% or more of the headword's COCA uses and needs a different Japanese cue; at most 3 senses per headword; left-out uses are noted.
- COCA is used as evidence (senses, inflected-form frequencies, collocations, typical contexts). Item sentences are original, modeled on frequent COCA patterns, not copied from the corpus, so the bank can be shared openly without reproducing licensed corpus text.
- Sentences per sense: during the start-up phase (until the app runs smoothly), the live bank holds ONE sentence per meaning sense (the first drafted). Drafting continues to target 3–5 sentences per sense, kept in the item files, so the full set can be switched on later without new drafting. Inflected forms chosen roughly in proportion to their COCA frequency.
- Allow grammatical inflections, including irregular forms, but exclude derivational forms. Examples: open → opens/opened/opening; go → went/gone; happy → happier/happiest. Do not expand happy to happiness/happily or open to opener/openness. Lexicalised -ing forms that carry a frequent sense (according, regarding) are allowed.
- Each question must define the answer form required by its sentence. Allowing inflections does not mean accepting any inflected form in every sentence.
- Use natural English example sentences and accurate Japanese cues. Naturalness takes priority over the "unguessable" requirement used for the test items; some loss of psychometric rigour in quizzes is accepted.
- Cues are Japanese only; they never contain English letters (which could give the answer away).
- First-letter prompts: every item shows the first letter of the answer in the blank (as in productive cloze tests), which settles synonym competition (kid/child, opportunity/chance).
- Other words in each sentence: NGSL words or common school words / loanwords (allowlist); short everyday sentences.
- American spelling throughout.
- Avoid contractions in quiz answers.

## ITEM BANK SCHEMA (v1)
- Headword: NGSL rank, curriculum order (position after filtering), lemma, notes, list of senses.
- Sense: sense ID, part of speech, short Japanese gloss, COCA pattern, list of sentence items.
- Sentence item: item ID, sentence with a single blank (___), required answer, form label (base, 3sg, past, past participle, -ing, plural, comparative, superlative), Japanese cue matching that form in context, source ("authored (COCA-informed)"), review status (draft / reviewed).
- One required answer per item (American spelling, no contractions); no alternative answers unless a later decision adds them.

## ITEM BANK PIPELINE
- Scripts live on the KINGSTON drive (vocab_app_pipeline) and in the Project (claude/pipeline): build_wordlist.py → coca_profile.py (runs on the Mac; resumable; ~1 min per word) → drafting by Claude → check_items.py (automatic checks, builds bank_weekNN.json; `--per-sense 1` for the start-up bank, full set as bank_weekNN_full.json) → make_review.py (review spreadsheet for Brandon).
- Week 1 (NGSL 500–551): 50 headwords, 82 senses. Live bank: 82 items (one per sense), loaded in the prototype; full draft set: 298 items. Awaiting Brandon's review (82 items).
- Each bank_weekNN.json is loaded into the quiz backend through the admin console (Item bank tab); loading a week replaces that week's items.

## STUDENT PRACTICE
- Students practise on their phones without creating an account or password.
- Practice runs entirely on the phone (static web page); no practice data is sent to a server.
- Show an ENGLISH sentence with the target word blanked out and a JAPANESE meaning cue beside or below it. Do not replace the English sentence with a Japanese sentence.
- The blank shows the answer's first letter, and the answer box starts with that letter already typed; an answer of only the given letter counts as blank.
- Each word should eventually have multiple example sentences to aid with acquisition (one per sense during start-up; a recycled sense then reuses the same sentence).
- Example: "She o___ the window yesterday." Cue: "開けた". Required answer: "opened".
- Students type using a normal (full) keyboard during practice.
- Practice is timed in the same way as quizzes (default 10 seconds per item, the same visible countdown), so students practise under test conditions. When time runs out, anything typed is checked; an empty answer counts as a miss.
- After a miss (wrong or blank), the same item stays on screen with the correct answer filled in, the timer shows as paused, and the next item appears only after Continue or Enter (presses in the first 0.6 s are ignored). Correct answers advance automatically.
- Ignore capitalisation and accidental surrounding spaces.
- Each meaning sense appears once per practice session, except when recycled after a missed answer. Missed senses reappear later in the session, preferably with a different sentence.
- Students can select a 50-word set to study, or the whole quiz range.
- The progress moon (see NAME AND IDENTITY) shows how many meanings in the selected set have been learned; the record is kept on the phone and is never sent to the server.

## CLASSROOM QUIZZES
- Short, low-stress classroom quizzes provide accountability.
- Each student sees a different quiz — a random arrangement of possible quiz items (both target words and context sentences).
- Each headword appears at most once per quiz, regardless of how many senses it has.
- Workflow (administrator-run, implemented in v7): select the week and settings, start a session, display a QR code (and a 6-character code for typing), students enter their four-word ID and answer, close the session, export results.
- Default quiz length 20 items per student (adjustable, maximum 40).
- Two keyboard formats; only one is used in a given quiz: (1) full keyboard; (2) restricted on-screen keyboard where only letters occurring in the answer are enabled, other letters disabled. Default quiz format is restricted (practice is full keyboard); a teacher may choose full keyboard for quizzes. In both formats the first letter is shown and pre-typed, as in practice.
- The restricted keyboard is not a letter-tile rearrangement task. Available letters can be used repeatedly.
- The keyboard format is recorded in the CSV results; scores across formats do not need to be compared.
- Quiz feedback appears after submission rather than after each question.
- Each quiz item has a time limit; default 10 seconds (to be reviewed after piloting), shared with practice. A large seconds-left countdown and a draining bar show the remaining time; both turn red in the last 3 seconds.
- Answers are kept on the phone during the quiz and sent once at the end (retry if the connection fails); marking is done on the server. Reloading the page mid-item counts that item as answered with what was typed.
- One attempt per identifier per quiz; a student can resume only on the same device. The administrator can reset a student (deletes that attempt) if a phone fails.

## CURRICULUM
- Initially use one standardised programme across the department.
- Make the number of new words per week adjustable; approximately 30–50 is the intended range.
- Quiz coverage is cumulative. For 50 words per week, weeks 1, 2, and 3 cover the first 50, 100, and 150 content words from rank 500 onward.
- Default quiz selection is approximately 80% current-week words and 20% earlier words. Week 1 uses only its own words.
- Make the new/review proportion adjustable.
- Avoid duplicate questions within a quiz, and explicitly handle cases where a word pool is too small (implemented: a short review pool is topped up with current-week words; the admin is warned when the total pool is smaller than the quiz length).
- Teacher-defined curricula and support for other institutions are later features.

## IDENTIFIERS AND PRIVACY
- Give each student a memorable identifier consisting of four randomly assigned, appropriate NGSL content words, with duplicate checking (generated in the admin console from a curated list of about 280 everyday words).
- The administrator keeps the mapping between student identities and these identifiers locally. Roster files are read in the browser and never uploaded.
- The server keeps the list of valid identifiers and class labels (no names) so that mistyped IDs are rejected at join. Decided 2026-11-10.
- A four-word identifier is a label, not a password or proof of identity. This limitation has been discussed and accepted for the prototype.
- Temporary quiz answers, scores, and pseudonymous identifiers on a server are acceptable, provided they are protected and cannot be directly mapped to names without the separate roster.
- Server-side quiz results are deleted automatically 30 days after the quiz is created (nightly job, 03:00 JST). D1 point-in-time recovery keeps 7 days of history on the free plan, so deleted results are unrecoverable after about 37 days.
- Do not store student names, emails, student numbers, or the roster mapping on our server.
- Do not claim that pseudonymous data is fully anonymous or that the system has "nothing to hack." Consider access controls, retention, logging, and quiz integrity when designing the real backend.
- If cloud backup is added later, the identifier alone must not allow someone to retrieve or overwrite another student's data.

## ADMINISTRATION AND TEACHER EXPERIENCE
- For now, a single administrator runs everything: quiz sessions, results, and roster matching. Teachers do not log in.
- Admin console is protected by a long random administrator key (Cloudflare secret).
- Results reach teachers by printout or a weekly email after quizzes (all quizzes run at the same time each week, so a weekly batch is practical).
- Microsoft institutional sign-in for teachers is deferred and may not be needed.
- CSV downloads: per-quiz summary and item-level CSVs (identifier only); named versions are produced in the browser by joining the local roster. Times are in Japan time.

## ARCHITECTURE
- Practice: static, installable web page; progress kept on the device only.
- Quizzes: Cloudflare Workers + D1 (free plan, database in Asia-Pacific), personal Cloudflare account. Code in claude/quiz-backend (README) and the vocab-quiz folder. Free-plan limits (100,000 requests/day, 1,000/min; 100,000 rows written/day) are far above pilot needs; one batched submission per student keeps department-wide use under the per-minute limit.
- Build order: (1) practice prototype with sample bank; (2) item bank pipeline from NGSL + COCA; (3) quiz backend and administrator console (built 2026-11-10, awaiting deployment); (4) pilot.

## PILOT
- One or two of Brandon's classes (about 15–16 students each). Consider ethics approval beforehand if results may be published.

---

## OPEN QUESTIONS
1. Borderline words (listed in the week-1 review spreadsheet): include or exclude, e.g. accord (according to), due, instead, interjections, homographs. (Sensitive words decided 2026-11-12: include with careful sentences.)
2. Whether the practice page should also be served from the Cloudflare site (one address for students).
3. When to switch from one sentence per sense to the full 3–5 (after the pilot runs smoothly).
4. Whether to rename the quiz backend from "vocab-quiz" to "crescent" before first deployment (this sets the site address, crescent.<subdomain>.workers.dev; cheap now, awkward after students have the address).

## CHANGE LOG
- 2026-10-30 — v1: initial spec imported from Brandon's notes.
- 2026-10-30 — v2: decisions added — own COCA-based sense inventory; naturalness over unguessability; American spelling; no contractions in answers; practice once per sense with recycling; quiz once per headword; one keyboard format per quiz, recorded in CSV; 10 s default time limit; 1-month retention; administrator-only operation with print/email results; architecture split; item schema v1.
- 2026-10-30 — v3: start at NGSL rank 500; exclude function words; 3–5 sentences per sense; four-word identifiers only; prominent quiz countdown; sample bank replaced with ranks 500–509.
- 2026-10-30 — v4: practice timed like quizzes (shared 10 s limit and countdown); timeouts in practice count as misses and recycle the sense.
- 2026-10-31 — v5: miss feedback holds the item until Continue; NGSL 1.2 source files; COCA as evidence with original sentences; sense inclusion rule (~10%); item pipeline built; week 1 bank (298 items) drafted and loaded.
- 2026-10-31 — v6: first letter shown on every prompt (practice and quizzes); official NGSL 1.2 ranks used for numbering (2,260 curriculum words); cues made Japanese-only (10 cues rewritten) with an automatic check.
- 2026-11-10 — v7: quiz hosting decided (Cloudflare Workers + D1, personal account); valid four-word IDs kept on the server (no names); quiz backend and admin console built (QR join, restricted keyboard, server marking, CSV, local name matching, ID generation, 30-day deletion); default 20 items per quiz.
- 2026-11-10 — v8: start-up phase uses one sentence per meaning sense (week 1 live bank 82 items; full 298 kept); check_items.py --per-sense option.
- 2026-11-12 — v9: app named Crescent; progress moon added to the practice prototype (fills as meanings are learned, stored on the phone only); sensitive words (kill, drug, sex) included with careful sentences.
