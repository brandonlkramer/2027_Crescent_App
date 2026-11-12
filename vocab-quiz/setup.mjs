// One-time setup: create the D1 database (Asia-Pacific), create tables, deploy, set the admin key.
// Run after `npx wrangler login`:   npm run setup
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const run = (args, opts = {}) => {
  const r = spawnSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: opts.capture ? ["pipe", "pipe", "inherit"] : "inherit", input: opts.input, shell: process.platform === "win32" });
  if (r.status !== 0) { console.error(`\nStopped: wrangler ${args.join(" ")} failed.`); process.exit(1); }
  return r.stdout || "";
};

const cfgPath = "wrangler.jsonc";
let cfg = readFileSync(cfgPath, "utf8");

if (cfg.includes("REPLACE_WITH_DATABASE_ID")) {
  console.log("\n1/4 Creating the database (Asia-Pacific)…");
  const out = run(["d1", "create", "vocab-quiz", "--location", "apac"], { capture: true });
  process.stdout.write(out);
  const m = out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!m) { console.error("Could not find the database ID in the output above. Paste it into wrangler.jsonc by hand and run `npm run setup` again."); process.exit(1); }
  cfg = cfg.replace("REPLACE_WITH_DATABASE_ID", m[0]);
  writeFileSync(cfgPath, cfg);
  console.log(`   Saved database ID ${m[0]} in wrangler.jsonc`);
} else {
  console.log("\n1/4 Database already set in wrangler.jsonc — skipping.");
}

console.log("\n2/4 Creating tables…");
run(["d1", "execute", "vocab-quiz", "--remote", "--file", "schema.sql", "--yes"]);

console.log("\n3/4 Deploying…");
run(["deploy"]);

console.log("\n4/4 Setting the administrator key…");
const key = randomBytes(18).toString("base64url");
run(["secret", "put", "ADMIN_KEY"], { input: key + "\n", capture: true });

console.log("\n==============================================");
console.log(" Done.");
console.log(" Admin console:  the https://vocab-quiz.….workers.dev address printed above, plus /admin");
console.log(` Admin key:      ${key}`);
console.log(" Save the key in your password manager now. It is not stored anywhere else.");
console.log(" To change it later:  npx wrangler secret put ADMIN_KEY");
console.log("==============================================\n");
