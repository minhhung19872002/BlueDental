import type { LocationOption } from "@/utils/vietnamLocations";

/** The card's address, split into what the hồ sơ dialog collects. */
export interface CardAddress {
  /** Số nhà/ Đường — everything before the ward. */
  street: string;
  /** Today's province and ward, when they could be worked out. */
  provinceCode: string | null;
  provinceName: string | null;
  wardCode: string | null;
  wardName: string | null;
  /**
   * The address verbatim when it is in the pre-2025 shape (ward, district,
   * province). Null when the card already prints the new two tiers.
   */
  oldAddress: string | null;
}

/**
 * Old province / district / ward → new ward code(s), built by
 * scripts/build-old-ward-map.mjs from vietnam-address-database
 * (Resolution 202/2025/QH15). "a|b" marks an old ward split across two.
 */
export interface OldWardMap {
  provinces: Record<string, { to: string; districts: Record<string, Record<string, string>> }>;
}

export interface AddressSources {
  oldWards: OldWardMap;
  provinces: LocationOption[];
  loadWards: (provinceCode: string) => Promise<LocationOption[]>;
}

/** Case-, accent- and punctuation-blind, so "Khánh Hoà" meets "Khánh Hòa". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[.\-–_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PROVINCE_TIER = /^(thanh pho|tinh|tp)\s+/;
const DISTRICT_TIER = /^(quan|huyen|thi xa|thanh pho|tx|tp|q|h)\s+/;
const WARD_TIER = /^(phuong|xa|thi tran|dac khu|tt|p|x)\s+/;

/** Pre-2025 names of provinces that were renamed rather than merged. */
const FORMER_PROVINCE_NAMES: Record<string, string> = {
  "thua thien hue": "hue",
};

/** Names a card writes differently from the official list. */
const PROVINCE_ALIASES: Record<string, string> = {
  ...FORMER_PROVINCE_NAMES,
  hcm: "ho chi minh",
  tphcm: "ho chi minh",
};

/** "Phường 07" and "P.7" are both ward "7". */
function bare(value: string, tier: RegExp): string {
  const name = fold(value).replace(tier, "");
  return /^\d+$/.test(name) ? String(Number(name)) : name;
}

function provinceKey(name: string): string {
  const key = bare(name, PROVINCE_TIER);
  return PROVINCE_ALIASES[key] ?? key;
}

/**
 * The one entry a written name means. Two old units can share a bare name
 * ("Huyện Kỳ Anh" / "Thị xã Kỳ Anh"); the tier the card printed decides, and a
 * bare name that still fits both is left unanswered rather than guessed.
 */
function pick<T>(entries: Record<string, T>, written: string, tier: RegExp): T | null {
  const wanted = bare(written, tier);
  const matches = Object.entries(entries).filter(([name]) => bare(name, tier) === wanted);
  if (matches.length === 1) return matches[0][1];

  const exact = matches.filter(([name]) => fold(name) === fold(written));
  return exact.length === 1 ? exact[0][1] : null;
}

function hasTier(written: string, tier: RegExp): boolean {
  return tier.test(fold(written));
}

interface Resolved {
  street: string;
  provinceCode: string;
  wardCode: string | null;
  isOld: boolean;
}

/** Reads `…, ward, district, province` against the pre-2025 units. */
function readOld(parts: string[], sources: AddressSources): Resolved | null {
  const n = parts.length;
  const province = oldProvince(parts[n - 1], sources);
  if (!province || n < 2) return null;

  // "Phường X" in the district slot is a new-shape address, not an old one.
  const districtPart = parts[n - 2];
  if (hasTier(districtPart, WARD_TIER)) return null;

  const district = pick(province.districts, districtPart, DISTRICT_TIER);
  if (!district) return null;

  const wardPart = n >= 3 ? parts[n - 3] : null;
  const codes = wardPart ? pick(district, wardPart, WARD_TIER) : null;
  // A bare district name is only trusted when a ward of it follows, or the
  // card spelled the tier out; otherwise the new reading gets its turn.
  if (!codes && !hasTier(districtPart, DISTRICT_TIER)) return null;

  const single = codes && !codes.includes("|") ? codes : null;
  return {
    street: parts.slice(0, codes ? n - 3 : n - 2).join(", "),
    provinceCode: province.to,
    wardCode: single,
    isOld: true,
  };
}

/** Reads `…, ward, province` against today's units. */
async function readNew(
  parts: string[],
  provinceCode: string,
  sources: AddressSources,
): Promise<Resolved> {
  const n = parts.length;
  const wards = n >= 2 ? await sources.loadWards(provinceCode) : [];
  const byName = Object.fromEntries(wards.map((ward) => [ward.name, ward.code]));
  const wardCode = n >= 2 ? pick(byName, parts[n - 2], WARD_TIER) : null;

  return {
    street: parts.slice(0, wardCode ? n - 2 : n - 1).join(", "),
    provinceCode,
    wardCode,
    isOld: false,
  };
}

function oldProvince(written: string, sources: AddressSources) {
  const key = provinceKey(written);
  return (
    Object.entries(sources.oldWards.provinces).find(([name]) => provinceKey(name) === key)?.[1] ??
    null
  );
}

function newProvinceCode(written: string, sources: AddressSources): string | null {
  const key = provinceKey(written);
  const current = sources.provinces.find((row) => provinceKey(row.name) === key);
  // A province merged away in 2025 resolves to its successor.
  return current?.code ?? oldProvince(written, sources)?.to ?? null;
}

/**
 * Splits the address printed on a card into street / ward / province and
 * works out today's province and ward.
 *
 * Cards print either shape, usually without the "Xã"/"Huyện" words, so the
 * shape is decided by the data: when the last three parts are a ward of a
 * district of a pre-2025 province, it is an old address — kept verbatim in
 * {@link CardAddress.oldAddress} and converted through the merger table.
 * Otherwise the last two parts are read as today's ward and province.
 */
export async function splitCardAddress(
  address: string,
  sources: AddressSources,
): Promise<CardAddress> {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const trimmed = address.trim();
  const unknown: CardAddress = {
    street: trimmed,
    provinceCode: null,
    provinceName: null,
    wardCode: null,
    wardName: null,
    oldAddress: null,
  };
  if (parts.length === 0) return unknown;

  const provinceCode = newProvinceCode(parts[parts.length - 1], sources);
  if (!provinceCode) return unknown;

  const resolved = readOld(parts, sources) ?? (await readNew(parts, provinceCode, sources));

  // A province that no longer exists, or goes by its former name, can only be
  // an old address, even when its district could not be read.
  const written = parts[parts.length - 1];
  const gone =
    bare(written, PROVINCE_TIER) in FORMER_PROVINCE_NAMES ||
    !sources.provinces.some((row) => provinceKey(row.name) === provinceKey(written));
  const isOld = resolved.isOld || gone;

  const wards = resolved.wardCode ? await sources.loadWards(resolved.provinceCode) : [];
  return {
    street: resolved.street,
    provinceCode: resolved.provinceCode,
    provinceName: sources.provinces.find((row) => row.code === resolved.provinceCode)?.name ?? null,
    wardCode: resolved.wardCode,
    wardName: wards.find((row) => row.code === resolved.wardCode)?.name ?? null,
    oldAddress: isOld ? trimmed : null,
  };
}

/** Narrows the fetched JSON to {@link OldWardMap} without trusting it blindly. */
export function isOldWardMap(value: unknown): value is OldWardMap {
  if (typeof value !== "object" || value === null || !("provinces" in value)) return false;
  const { provinces } = value;
  if (typeof provinces !== "object" || provinces === null) return false;
  const first = Object.values(provinces)[0];
  return typeof first === "object" && first !== null && "to" in first && "districts" in first;
}
