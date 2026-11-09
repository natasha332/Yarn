import { zodOutputFormat } from "../../node_modules/@anthropic-ai/sdk/helpers/zod.mjs";
import { SortResult } from "../../src/lib/sort-schema.ts";
import assert from "node:assert/strict";
// Anthropic's structured output limits (docs: "Structured outputs" -> schema complexity):
//   at most 24 optional parameters and at most 16 parameters that use anyOf / type arrays (nullable fields).
const fmt: any = zodOutputFormat(SortResult);
const schema = fmt.schema ?? fmt.json_schema?.schema ?? fmt;
let unions = 0, optional = 0; const unionNames: string[] = [];
const seen = new Set<any>();
function walk(node: any, path: string) {
  if (!node || typeof node !== "object") return;
  if (node.$ref) { const target = node.$ref.replace(/^#\//, "").split("/").reduce((o: any, k: string) => o?.[k], schema); if (!seen.has(target)) { seen.add(target); walk(target, path); } return; }
  if (node.properties) {
    const required = new Set(node.required ?? []);
    for (const [k, v] of Object.entries<any>(node.properties)) {
      if (!required.has(k)) optional++;
      if (v.anyOf || Array.isArray(v.type)) { unions++; unionNames.push(`${path}.${k}`); }
      walk(v, `${path}.${k}`);
    }
  }
  if (node.items) walk(node.items, path + "[]");
  for (const key of ["anyOf", "allOf"]) if (node[key]) node[key].forEach((n: any) => walk(n, path));
  if (node.$defs) Object.values(node.$defs).forEach((n: any) => walk(n, path));
}
walk(schema, "$");
console.log("union (nullable) parameters:", unions, "of max 16");
console.log("optional parameters:", optional, "of max 24");
console.log(unionNames.join(", "));
assert.ok(unions <= 16, `too many nullable fields: ${unions} (max 16)`);
assert.ok(optional <= 24, `too many optional fields: ${optional} (max 24)`);
console.log("ok - the sorter's schema is within Anthropic's limits");
