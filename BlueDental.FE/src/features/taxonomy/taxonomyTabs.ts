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
  /** The BE ability subject used for permission gating on this tab. */
  subject: string;
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
  /**
   * True on the catalogs that can be bulk-loaded from an Excel file — a
   * BlueDental addition the reference does not have. Bệnh án mẫu is deferred;
   * thẻ hồ sơ and phương thức thanh toán are not taxonomy-backed.
   */
  importable?: boolean;
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
      importable: true,
      label: t("Taxonomy:Tab:Service"),
      subject: "catalogService",
      group: TAXONOMY_GROUP.CareService,
      noun: t("Taxonomy:Noun:Service"),
      priced: true,
      dialog: "service",
    },
    {
      key: "diagnosis",
      importable: true,
      label: t("Taxonomy:Tab:Diagnosis"),
      subject: "catalogDiagnosis",
      group: TAXONOMY_GROUP.Diagnosis,
      noun: t("Taxonomy:Noun:Diagnosis"),
      dialog: "rich",
    },
    {
      key: "medicine",
      importable: true,
      label: t("Taxonomy:Tab:Medicine"),
      subject: "catalogMedicine",
      group: TAXONOMY_GROUP.MedicationType,
      noun: t("Taxonomy:Noun:Medicine"),
      priced: true,
      dialog: "medicine",
    },
    {
      key: "consulting",
      importable: true,
      label: t("Taxonomy:Tab:Consulting"),
      subject: "catalogConsultation",
      group: TAXONOMY_GROUP.ConsultingData,
      noun: t("Taxonomy:Noun:Consulting"),
      dialog: "rich",
    },
    {
      key: "source",
      importable: true,
      label: t("Taxonomy:Tab:Source"),
      subject: "catalogSource",
      group: TAXONOMY_GROUP.Source,
      noun: t("Taxonomy:Noun:Source"),
      dialog: "simple",
    },
    {
      key: "history",
      importable: true,
      label: t("Taxonomy:Tab:History"),
      subject: "catalogHistory",
      group: TAXONOMY_GROUP.DiseaseHistory,
      noun: t("Taxonomy:Noun:History"),
      dialog: "simple",
    },
    {
      key: "prescription-template",
      importable: true,
      label: t("Taxonomy:Tab:PrescriptionTemplate"),
      subject: "catalogPrescription",
      group: TAXONOMY_GROUP.PrescriptionTemplate,
      noun: t("Taxonomy:Noun:PrescriptionTemplate"),
      grouped: false,
      templated: true,
      dialog: "prescription",
    },
    {
      key: "medical-record-template",
      label: t("Taxonomy:Tab:MedicalRecordTemplate"),
      subject: "catalogTemplate",
      group: TAXONOMY_GROUP.MedicalRecordTemplate,
      noun: t("Taxonomy:Noun:MedicalRecordTemplate"),
      templated: true,
      dialog: "medical-record",
    },
    { key: "tags", label: t("Taxonomy:Tab:Tags"), subject: "catalogRecordTag", group: null, noun: t("Taxonomy:Noun:Tags"), screen: "tags" },
    {
      key: "payment-method",
      label: t("Taxonomy:Tab:PaymentMethod"),
      subject: "catalogPaymentMethod",
      group: null,
      noun: t("Taxonomy:Noun:PaymentMethod"),
      screen: "payment-method",
    },
    {
      key: "occupation",
      label: t("Taxonomy:Tab:Occupation"),
      subject: "catalogOccupation",
      group: TAXONOMY_GROUP.Occupation,
      noun: t("Taxonomy:Noun:Occupation"),
      dialog: "simple",
      exportable: false,
      importable: true,
    },
  ];
}

export function findTaxonomyTab(tabs: TaxonomyTab[], key: string | undefined): TaxonomyTab {
  return tabs.find((tab) => tab.key === key) ?? tabs[0];
}
