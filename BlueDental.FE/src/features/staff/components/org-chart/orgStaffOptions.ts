import { t } from "@/lib/i18n";
import type { OrgChartIndex } from "./orgChartModel";

export interface StaffOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface PickerRules {
  /** The unit being edited; its own head and members are not "elsewhere". */
  selfUnitId: string | null;
  exclude?: Set<string>;
  /** Members may not head another unit — the server refuses them (OrgChart:0010). */
  blockOtherHeads?: boolean;
}

/**
 * The people a picker offers: active staff by name, each label saying where
 * the person sits now so a move is never a surprise.
 */
export function staffPickerOptions(index: OrgChartIndex, rules: PickerRules): StaffOption[] {
  return index.activeStaff
    .filter((s) => !rules.exclude?.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"))
    .map((person) => {
      const headed = otherUnitHeadedBy(index, person.id, rules.selfUnitId);
      const unit = index.unitOfStaff.get(person.id);
      const where = headed
        ? t("OrgChart:Picker:HeadOf", headed.name)
        : unit
          ? unit.name
          : t("OrgChart:Picker:Unassigned");
      return {
        value: person.id,
        label: `${person.name} · ${where}`,
        disabled: Boolean(rules.blockOtherHeads && headed),
      };
    });
}

/** The unit `staffId` already heads, other than `selfUnitId`. */
export function otherUnitHeadedBy(index: OrgChartIndex, staffId: string, selfUnitId: string | null) {
  const headed = index.headedBy.get(staffId);
  return headed && headed.id !== selfUnitId ? headed : undefined;
}
