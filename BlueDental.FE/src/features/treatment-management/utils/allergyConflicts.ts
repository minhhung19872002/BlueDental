/**
 * Allergy check for a prescription (R-744, QA dòng 6).
 *
 * The catalogs carry no link between a Lịch sử bệnh entry and a Loại thuốc
 * group, so the check reads the names the clinic already types: an allergy
 * entry ("Dị ứng thuốc kháng sinh") is reduced to what the patient reacts to
 * ("khang sinh"), and a medicine is flagged when its group ("Nhóm Kháng Sinh")
 * or its own name says the same thing. It errs on the side of warning: an
 * allergy to "kháng sinh nhóm Penicillin" flags the whole antibiotic group.
 */

/** A catalog entry as the check needs it — a name and, for medicines, the group. */
export interface NamedEntry {
  id: string;
  name: string;
  taxonomyName: string | null;
}

export interface AllergyConflict {
  medicineId: string;
  medicineName: string;
  groupName: string | null;
  /** The patient's allergy entries this medicine falls under, as named in the catalog. */
  allergyNames: string[];
}

const ALLERGY_PHRASE = "di ung";
/** Words that frame a name without saying what it is about: "Nhóm thuốc …", "Dị ứng với …". */
const FILLER_WORDS = new Set(["thuoc", "nhom", "voi", "loai", "cac"]);

/** Lower case, no accents, "đ" as "d", words split on anything but letters and digits. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The subject of a name: "Dị ứng thuốc kháng sinh" → "khang sinh". */
function subjectOf(text: string): string {
  return normalize(text)
    .replace(new RegExp(`\\b${ALLERGY_PHRASE}\\b`, "g"), " ")
    .split(" ")
    .filter((word) => word && !FILLER_WORDS.has(word))
    .join(" ");
}

/** Whole-word containment, so "te" (thuốc tê) never matches inside "tetracyclin". */
function hasPhrase(haystack: string, needle: string): boolean {
  return needle.length > 0 && ` ${haystack} `.includes(` ${needle} `);
}

/** An allergy is any entry named "Dị ứng …" or filed under a "Dị ứng" group. */
function isAllergy(entry: NamedEntry): boolean {
  return [entry.name, entry.taxonomyName ?? ""].some((text) => hasPhrase(normalize(text), ALLERGY_PHRASE));
}

function falls(medicine: NamedEntry, allergySubject: string): boolean {
  const group = subjectOf(medicine.taxonomyName ?? "");
  const sameGroup = group.length > 0 && (hasPhrase(allergySubject, group) || hasPhrase(group, allergySubject));
  return sameGroup || hasPhrase(normalize(medicine.name), allergySubject);
}

/**
 * The medicines of `medicines` that fall under one of the patient's allergies,
 * once each, in the order given. `history` is the patient's ticked Lịch sử
 * bệnh entries; the ones that are not allergies are ignored.
 */
export function findAllergyConflicts(history: NamedEntry[], medicines: NamedEntry[]): AllergyConflict[] {
  const allergies = history
    .filter(isAllergy)
    .map((entry) => ({ name: entry.name, subject: subjectOf(entry.name) }))
    .filter((allergy) => allergy.subject.length > 0);
  if (allergies.length === 0) return [];

  const seen = new Set<string>();
  return medicines.flatMap((medicine) => {
    if (seen.has(medicine.id)) return [];
    seen.add(medicine.id);
    const matched = allergies.filter((allergy) => falls(medicine, allergy.subject));
    if (matched.length === 0) return [];
    return [{
      medicineId: medicine.id,
      medicineName: medicine.name,
      groupName: medicine.taxonomyName,
      allergyNames: matched.map((allergy) => allergy.name),
    }];
  });
}
