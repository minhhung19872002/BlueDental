import { t } from "@/lib/i18n";

/**
 * The three sections of Vật tư, in the reference's order.
 *
 * Each is its own route, as the reference makes them, so a section can be
 * linked to and reached with the back button.
 */
export interface MaterialsTab {
  key: string;
  label: string;
}

export function materialsTabs(): MaterialsTab[] {
  return [
    { key: "clinic", label: t("Materials:ClinicTab") },
    { key: "allocation", label: t("Materials:AllocationTab") },
    { key: "department", label: t("Materials:DepartmentTab") },
  ];
}

export const DEFAULT_MATERIALS_TAB = "clinic";

export function findMaterialsTab(key: string | undefined): MaterialsTab {
  const all = materialsTabs();
  return all.find((tab) => tab.key === key) ?? all[0];
}

/** The taxonomy collection the material groups live in, as the reference files them. */
export const SUPPLIES_GROUP = "supplies";
