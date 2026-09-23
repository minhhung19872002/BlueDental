import { t } from "@/lib/i18n";

/**
 * Taxonomy group slugs the Labo catalogs file their rows under, matching
 * BlueDental.Catalogs.TaxonomyGroups.
 *
 * The reference keeps Khớp cắn, Đường hoàn tất and Kiểu nhịp in its one shared
 * taxonomy collection (`group=joint|line|bridge`) rather than in three tables
 * of their own, and so does BlueDental — the slugs differ, the shape does not.
 * See docs/clone/api.md §Labo.
 */
export const LABO_GROUP = {
  Bite: "labo_bite",
  FinishLine: "labo_finish_line",
  Rhythm: "labo_rhythm",
  Material: "labo_material",
} as const;

/**
 * One sub-route of /labo.
 *
 * The reference renders a tab only when the account may read its subject, so
 * `subject` is carried here ready for that gate; every tab is shown until the
 * permission API is wired up.
 */
export interface LaboTab {
  /** Route slug under /labo, matching the reference URLs. */
  key: string;
  label: string;
  /** Reference permission subject — see docs/clone/api.md §Labo. */
  subject: string;
  /** Which screen renders the tab. */
  screen: "orders" | "supplier" | "catalog" | "service-material";
  /** Taxonomy group backing a flat catalog tab. */
  group?: string;
  /**
   * The lowercase noun the reference builds a catalog tab's wording from: the
   * search placeholder, the create button, the dialog title and the field
   * label are all "{verb} {noun}".
   */
  noun?: string;
}

export const DEFAULT_LABO_TAB = "mau-labo";

export function laboTabs(): LaboTab[] {
  return [
    { key: "mau-labo", label: t("Labo:Tab:Orders"), subject: "laboTemplate", screen: "orders" },
    {
      key: "supplier",
      label: t("Labo:Tab:Supplier"),
      subject: "laboSupplier",
      screen: "supplier",
    },
    {
      key: "bite",
      label: t("Labo:Tab:Bite"),
      subject: "laboBite",
      screen: "catalog",
      group: LABO_GROUP.Bite,
      noun: t("Labo:Noun:Bite"),
    },
    {
      key: "finish-line",
      label: t("Labo:Tab:FinishLine"),
      subject: "laboFinishLine",
      screen: "catalog",
      group: LABO_GROUP.FinishLine,
      noun: t("Labo:Noun:FinishLine"),
    },
    {
      key: "nhip",
      label: t("Labo:Tab:Rhythm"),
      subject: "laboRhythm",
      screen: "catalog",
      group: LABO_GROUP.Rhythm,
      noun: t("Labo:Noun:Rhythm"),
    },
    {
      key: "service-material",
      label: t("Labo:Tab:ServiceMaterial"),
      subject: "laboMaterial",
      screen: "service-material",
      group: LABO_GROUP.Material,
      noun: t("Labo:Noun:Material"),
    },
  ];
}

export function findLaboTab(tabs: LaboTab[], key: string | undefined): LaboTab {
  return tabs.find((tab) => tab.key === key) ?? tabs[0];
}
