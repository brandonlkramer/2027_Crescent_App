// Builds tools/crescent-roster-tool.html with the ID word lists from public/idwords.js inlined.
import { readFileSync, writeFileSync } from "node:fs";
const words = readFileSync(new URL("../public/idwords.js", import.meta.url), "utf8");
const tpl = readFileSync(new URL("./roster-tool.template.html", import.meta.url), "utf8");
writeFileSync(new URL("./crescent-roster-tool.html", import.meta.url), tpl.replace("/*IDWORDS*/", words));
console.log("Wrote tools/crescent-roster-tool.html");
