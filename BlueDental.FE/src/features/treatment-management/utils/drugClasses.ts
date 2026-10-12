/**
 * Drug classes the allergy check knows by their members (QA dòng 6, reopened).
 *
 * The clinic files a medicine wherever it likes — "Amoxicillin 500mg" sits in
 * "Nhóm thuốc chung" — so its group name cannot say it is an antibiotic. A
 * class is picked by what the allergy names (`aliases`, normalized subjects
 * such as "khang sinh") and holds the active ingredients and brands a dental
 * clinic prescribes (`stems`, matched against the start of each word of the
 * medicine's name, so "Amoxicilin" and "Amoxicillin" both match "amoxici").
 */
export interface DrugClass {
  aliases: string[];
  stems: string[];
}

const ANTIBIOTIC_STEMS = [
  // Penicillins
  "amoxici", "ampici", "penicil", "cloxaci", "oxaci", "augmentin", "klamentin", "curam", "unasyn", "sulbacta", "clavula",
  // Cephalosporins
  "cef", "cephal", "zinnat",
  // Macrolides
  "azithro", "clarithro", "erythro", "spiramy", "roxithro", "zithromax", "rovamy",
  // Others used in dentistry
  "metronida", "rodogyl", "clindamy", "dalacin", "lincomy", "doxycy", "tetracy", "minocy",
  "ciproflo", "levoflo", "moxiflo", "ofloxa", "cotrimox", "sulfamethox", "gentami",
];

export const DRUG_CLASSES: DrugClass[] = [
  {
    aliases: ["khang sinh", "antibiotic", "antibiotics", "penicillin", "penicilin", "beta lactam", "cephalosporin", "macrolid", "macrolide"],
    stems: ANTIBIOTIC_STEMS,
  },
  {
    aliases: ["te", "gay te", "te tai cho", "local anesthetic", "anesthetic"],
    stems: ["lidocai", "lignocai", "xylocai", "articai", "septanest", "ubistesin", "mepivacai", "scandonest", "prilocai", "bupivacai", "lignospan", "pehacai"],
  },
  {
    aliases: ["nsaid", "nsaids", "khang viem khong steroid", "aspirin", "giam dau khang viem"],
    stems: ["ibuprof", "diclofen", "meloxica", "piroxica", "naproxen", "ketoprof", "ketorola", "celecox", "etoricox", "aspirin", "acetylsalicyl", "alaxan", "mobic", "voltaren"],
  },
  {
    aliases: ["paracetamol", "acetaminophen"],
    stems: ["paracetamol", "acetaminophen", "efferalgan", "panadol", "hapacol", "tylenol"],
  },
];
