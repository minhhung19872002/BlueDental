/**
 * Calling codes by ISO 3166-1 alpha-2 country. NANP members keep their area
 * code in the dial ("1876" Jamaica) so the longest match names them; the US
 * and Canada share a bare "1".
 */
const DIAL_CODES: Record<string, string> = {
  AD: "376", AE: "971", AF: "93", AG: "1268", AI: "1264", AL: "355", AM: "374",
  AO: "244", AR: "54", AS: "1684", AT: "43", AU: "61", AW: "297", AX: "358",
  AZ: "994", BA: "387", BB: "1246", BD: "880", BE: "32", BF: "226", BG: "359",
  BH: "973", BI: "257", BJ: "229", BL: "590", BM: "1441", BN: "673", BO: "591",
  BQ: "599", BR: "55", BS: "1242", BT: "975", BW: "267", BY: "375", BZ: "501",
  CA: "1", CC: "61", CD: "243", CF: "236", CG: "242", CH: "41", CI: "225",
  CK: "682", CL: "56", CM: "237", CN: "86", CO: "57", CR: "506", CU: "53",
  CV: "238", CW: "599", CX: "61", CY: "357", CZ: "420", DE: "49", DJ: "253",
  DK: "45", DM: "1767", DO: "1809", DZ: "213", EC: "593", EE: "372", EG: "20",
  EH: "212", ER: "291", ES: "34", ET: "251", FI: "358", FJ: "679", FK: "500",
  FM: "691", FO: "298", FR: "33", GA: "241", GB: "44", GD: "1473", GE: "995",
  GF: "594", GG: "44", GH: "233", GI: "350", GL: "299", GM: "220", GN: "224",
  GP: "590", GQ: "240", GR: "30", GT: "502", GU: "1671", GW: "245", GY: "592",
  HK: "852", HN: "504", HR: "385", HT: "509", HU: "36", ID: "62", IE: "353",
  IL: "972", IM: "44", IN: "91", IO: "246", IQ: "964", IR: "98", IS: "354",
  IT: "39", JE: "44", JM: "1876", JO: "962", JP: "81", KE: "254", KG: "996",
  KH: "855", KI: "686", KM: "269", KN: "1869", KP: "850", KR: "82", KW: "965",
  KY: "1345", KZ: "7", LA: "856", LB: "961", LC: "1758", LI: "423", LK: "94",
  LR: "231", LS: "266", LT: "370", LU: "352", LV: "371", LY: "218", MA: "212",
  MC: "377", MD: "373", ME: "382", MF: "590", MG: "261", MH: "692", MK: "389",
  ML: "223", MM: "95", MN: "976", MO: "853", MP: "1670", MQ: "596", MR: "222",
  MS: "1664", MT: "356", MU: "230", MV: "960", MW: "265", MX: "52", MY: "60",
  MZ: "258", NA: "264", NC: "687", NE: "227", NF: "672", NG: "234", NI: "505",
  NL: "31", NO: "47", NP: "977", NR: "674", NU: "683", NZ: "64", OM: "968",
  PA: "507", PE: "51", PF: "689", PG: "675", PH: "63", PK: "92", PL: "48",
  PM: "508", PR: "1787", PS: "970", PT: "351", PW: "680", PY: "595", QA: "974",
  RE: "262", RO: "40", RS: "381", RU: "7", RW: "250", SA: "966", SB: "677",
  SC: "248", SD: "249", SE: "46", SG: "65", SH: "290", SI: "386", SJ: "47",
  SK: "421", SL: "232", SM: "378", SN: "221", SO: "252", SR: "597", SS: "211",
  ST: "239", SV: "503", SX: "1721", SY: "963", SZ: "268", TC: "1649", TD: "235",
  TG: "228", TH: "66", TJ: "992", TK: "690", TL: "670", TM: "993", TN: "216",
  TO: "676", TR: "90", TT: "1868", TV: "688", TW: "886", TZ: "255", UA: "380",
  UG: "256", US: "1", UY: "598", UZ: "998", VA: "39", VC: "1784", VE: "58",
  VG: "1284", VI: "1340", VN: "84", VU: "678", WF: "681", WS: "685", XK: "383",
  YE: "967", YT: "262", ZA: "27", ZM: "260", ZW: "263",
};

export const VIETNAM = "VN";

/** Listed first, in this order — the patients a clinic in Vietnam sees most. */
export const PREFERRED_COUNTRIES = [
  "VN", "US", "KR", "JP", "CN", "TW", "AU", "CA", "GB", "FR", "DE", "SG", "TH", "KH", "LA", "MY",
] as const;

/** Which country a shared code means when nothing else says (+1 → US, +7 → RU). */
const MAIN_FOR_SHARED_CODE = new Set(["US", "RU", "GB", "IT", "NO", "AU", "RE", "GP", "MA", "FI", "CW"]);

export const COUNTRY_CODES = Object.keys(DIAL_CODES);

/**
 * Where a leading 0 belongs to the number itself and is dialled after the
 * country code ("+39 06…" Rome, "+225 07…" Côte d'Ivoire); everywhere else
 * it is the trunk prefix and is dropped.
 */
const KEEPS_LEADING_ZERO = new Set(["IT", "VA", "SM", "CI", "CG", "GA"]);

export function keepsLeadingZero(iso: string): boolean {
  return KEEPS_LEADING_ZERO.has(iso);
}

export function dialCodeOf(iso: string): string {
  return DIAL_CODES[iso] ?? DIAL_CODES[VIETNAM];
}

const COUNTRY_BY_DIAL = new Map<string, string>();
for (const [iso, dial] of Object.entries(DIAL_CODES)) {
  if (!COUNTRY_BY_DIAL.has(dial) || MAIN_FOR_SHARED_CODE.has(iso)) COUNTRY_BY_DIAL.set(dial, iso);
}

const LONGEST_DIAL = Math.max(...Object.values(DIAL_CODES).map((dial) => dial.length));

/**
 * Leading digits (calling code included) that tell a territory apart from the
 * country it shares a code with: Canadian area codes under +1, Kazakhstan's
 * +76/+77 under +7, and the islands' own area codes. Territories whose number
 * plans overlap (Saint-Martin and Guadeloupe…) cannot be told apart and fall
 * back to the main country.
 */
const REGION_PREFIXES: Record<string, readonly string[]> = {
  CA: [
    "204", "226", "236", "249", "250", "257", "263", "289", "306", "343", "354", "365", "367", "368",
    "382", "387", "403", "416", "418", "428", "431", "437", "438", "450", "460", "468", "474", "506",
    "514", "519", "548", "579", "581", "584", "587", "600", "604", "613", "639", "647", "672", "683",
    "705", "709", "742", "753", "778", "780", "782", "807", "819", "825", "867", "873", "879", "902", "905",
  ].map((area) => `1${area}`),
  KZ: ["76", "77"],
  AX: ["35818"],
  VA: ["3906698"],
  GG: ["441481"],
  JE: ["441534"],
  IM: ["441624"],
  CC: ["6189162"],
  CX: ["6189164"],
  YT: ["262269", "262639"],
};

const REGION_BY_PREFIX = Object.entries(REGION_PREFIXES).flatMap(([iso, prefixes]) =>
  prefixes.map((prefix) => ({ iso, prefix })),
);

/**
 * The country whose calling code starts `digits`: a territory told apart by
 * its leading digits, else the longest code. `preferred` wins while its own code still fits, so a number
 * typed under Canada stays Canadian rather than turning into a US one.
 */
export function matchDialCode(digits: string, preferred?: string): { iso: string; dial: string } | undefined {
  if (preferred && DIAL_CODES[preferred] && digits.startsWith(DIAL_CODES[preferred])) {
    return { iso: preferred, dial: DIAL_CODES[preferred] };
  }
  const region = REGION_BY_PREFIX.find(({ prefix }) => digits.startsWith(prefix));
  if (region) return { iso: region.iso, dial: DIAL_CODES[region.iso] };
  for (let length = Math.min(LONGEST_DIAL, digits.length); length > 0; length--) {
    const dial = digits.slice(0, length);
    const iso = COUNTRY_BY_DIAL.get(dial);
    if (iso) return { iso, dial };
  }
  return undefined;
}
