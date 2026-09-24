// Builds src/features/patient-management/utils/oldWardMap.json — the old
// (pre-2025) province / district / ward → new ward table "Quét CCCD" uses to
// turn the address printed on a card into today's Tỉnh / Xã.
//
// Source: vietnam-address-database (MIT), Resolution 202/2025/QH15. Its raw
// file is ~4 MB; this keeps only names and codes, grouped so every name is
// written once.
//
//   node scripts/build-old-ward-map.mjs
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const db = require("vietnam-address-database/address.json");
const { version } = require("vietnam-address-database/package.json");

const table = (name) => db.find((item) => item.name === name).data;
const provinceCodeByName = new Map(table("provinces").map((p) => [p.name, p.province_code]));

/** @type {Record<string, { to: string, districts: Record<string, Record<string, string>> }>} */
const provinces = {};

for (const row of table("ward_mappings")) {
  // A handful of rows are brand-new units with no predecessor.
  if (!row.old_province_name || !row.old_district_name || !row.old_ward_name) continue;

  const to = provinceCodeByName.get(row.new_province_name);
  if (!to) throw new Error(`Unknown new province: ${row.new_province_name}`);

  const province = (provinces[row.old_province_name] ??= { to, districts: {} });
  // Whole provinces merged, so every ward of an old province lands in one new one.
  if (province.to !== to) throw new Error(`${row.old_province_name} spans two new provinces`);

  const wards = (province.districts[row.old_district_name] ??= {});
  const codes = new Set(wards[row.old_ward_name]?.split("|") ?? []);
  codes.add(row.new_ward_code);
  // An old ward split across several new ones keeps every candidate.
  wards[row.old_ward_name] = [...codes].sort().join("|");
}

const out = fileURLToPath(
  new URL("../src/features/patient-management/utils/oldWardMap.json", import.meta.url),
);
writeFileSync(out, JSON.stringify({ source: `vietnam-address-database@${version}`, provinces }));
console.log(`wrote ${out}: ${Object.keys(provinces).length} old provinces`);
