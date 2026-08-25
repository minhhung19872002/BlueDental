import { TAXONOMY_GROUP } from "./api/taxonomyApi";
import { t } from "@/lib/i18n";

/**
 * Every "Danh mục" sub-route is the same screen: the classification groups on
 * the left and the entries of the selected group on the right. Only the
 * taxonomy group slug and the noun in the wording change, so the sub-routes are
 * pure configuration rather than eleven near-identical pages.
 */
export interface TaxonomyTab {
  /** Route slug under /taxonomy, matching the reference URLs. */
  key: string;
  label: string;
  /** Taxonomy group slug, or null for catalogs BlueDental has not modelled yet. */
  group: string | null;
  /** Lowercase noun used in headings, buttons and placeholders. */
  noun: string;
  /**
   * False for the catalogs the reference shows as one flat table with no group
   * panel. Đơn thuốc mẫu is the only taxonomy-backed catalog built that way —
   * Bệnh án mẫu, its closest sibling, does keep its groups.
   */
  grouped?: boolean;
  priced?: boolean;
  templated?: boolean;
  /**
   * Which entry dialog this catalog uses. The reference gives each catalog its
   * own form rather than one shared one — "simple" is the name/group/state/
   * priority form that Nguồn đến, Lịch sử bệnh and Nghề nghiệp share.
   */
  dialog?: "simple" | "rich" | "service" | "medicine" | "prescription" | "medical-record";
  /** False on the catalogs the reference gives no "Xuất" button. */
  exportable?: boolean;
  /** Screens that are not taxonomy-backed at all and bring their own panel. */
  screen?: "tags" | "payment-method";
  /** Explains why a tab has no data source yet. */
  pendingNote?: string;
}

export const DEFAULT_TAXONOMY_TAB = "service";

export function taxonomyTabs(): TaxonomyTab[] {
  return [
    {
      key: "service",
      label: t("Dịch vụ"),
      group: TAXONOMY_GROUP.CareService,
      noun: t("dịch vụ"),
      priced: true,
      dialog: "service",
    },
    {
      key: "diagnosis",
      label: t("Chẩn đoán"),
      group: TAXONOMY_GROUP.Diagnosis,
      noun: t("chẩn đoán"),
      dialog: "rich",
    },
    {
      key: "medicine",
      label: t("Loại thuốc"),
      group: TAXONOMY_GROUP.MedicationType,
      noun: t("loại thuốc"),
      priced: true,
      dialog: "medicine",
    },
    {
      key: "consulting",
      label: t("Dữ liệu tư vấn"),
      group: TAXONOMY_GROUP.ConsultingData,
      noun: t("dữ liệu tư vấn"),
      dialog: "rich",
    },
    {
      key: "source",
      label: t("Nguồn đến"),
      group: TAXONOMY_GROUP.Source,
      noun: t("nguồn đến"),
      dialog: "simple",
    },
    {
      key: "history",
      label: t("Lịch sử bệnh"),
      group: TAXONOMY_GROUP.DiseaseHistory,
      noun: t("lịch sử bệnh"),
      dialog: "simple",
    },
    {
      key: "prescription-template",
      label: t("Đơn thuốc mẫu"),
      group: TAXONOMY_GROUP.PrescriptionTemplate,
      noun: t("đơn thuốc mẫu"),
      grouped: false,
      templated: true,
      dialog: "prescription",
    },
    {
      key: "medical-record-template",
      label: t("Bệnh án mẫu"),
      group: TAXONOMY_GROUP.MedicalRecordTemplate,
      noun: t("bệnh án mẫu"),
      templated: true,
      dialog: "medical-record",
    },
    { key: "tags", label: t("Thẻ hồ sơ"), group: null, noun: t("thẻ hồ sơ"), screen: "tags" },
    {
      key: "payment-method",
      label: t("Phương thức thanh toán"),
      group: null,
      noun: t("phương thức"),
      screen: "payment-method",
    },
    {
      key: "occupation",
      label: t("Nghề nghiệp"),
      group: TAXONOMY_GROUP.Occupation,
      noun: t("nghề nghiệp"),
      dialog: "simple",
      // The only catalog the reference gives no "Xuất" button.
      exportable: false,
    },
  ];
}

export function findTaxonomyTab(tabs: TaxonomyTab[], key: string | undefined): TaxonomyTab {
  return tabs.find((tab) => tab.key === key) ?? tabs[0];
}
