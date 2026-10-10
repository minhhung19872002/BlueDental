import type { Rule } from "antd/es/form";
import { t } from "@/lib/i18n";
import {
  ORG_UNIT_KIND,
  type CreatableOrgUnitKind,
  type CreateOrgUnitInput,
  type OrgUnitDto,
  type OrgUnitInput,
} from "../../api/orgChartApi";
import { normalizeUnitName, type OrgChartIndex } from "./orgChartModel";
import { otherUnitHeadedBy } from "./orgStaffOptions";

export interface OrgUnitFormValues {
  kind: CreatableOrgUnitKind;
  name: string;
  parentId?: string;
  headStaffId?: string;
  /** Members other than the head. */
  memberIds: string[];
  code?: string;
}

export function initialUnitValues(unit: OrgUnitDto | null, index: OrgChartIndex): OrgUnitFormValues {
  if (!unit || unit.kind === ORG_UNIT_KIND.Root) {
    return { kind: ORG_UNIT_KIND.DoctorTeam, name: "", parentId: index.root?.id, memberIds: [] };
  }
  return {
    kind: unit.kind,
    name: unit.name,
    parentId: unit.parentId ?? undefined,
    headStaffId: unit.headStaffId ?? undefined,
    memberIds: unit.members.map((m) => m.id).filter((id) => id !== unit.headStaffId),
    code: unit.code,
  };
}

export function toUnitInput(values: OrgUnitFormValues): CreateOrgUnitInput & OrgUnitInput {
  const head = values.headStaffId!;
  return {
    kind: values.kind,
    name: values.name.trim().replace(/\s+/g, " "),
    code: values.code?.trim() || null,
    parentId: values.parentId!,
    headStaffId: head,
    memberStaffIds: [head, ...values.memberIds.filter((id) => id !== head)],
  };
}

/** Other units, for the uniqueness checks. */
function others(index: OrgChartIndex, selfUnitId: string | null) {
  return index.units.filter((u) => u.id !== selfUnitId);
}

/** "Mỗi nhân sự chỉ được làm trưởng tối đa 1 đơn vị" (OrgChart:0005). */
export function headConflictRule(index: OrgChartIndex, selfUnitId: string | null): Rule {
  return {
    validator: (_, value?: string) => {
      const headed = value ? otherUnitHeadedBy(index, value, selfUnitId) : undefined;
      if (!headed) return Promise.resolve();
      const name = index.activeStaff.find((s) => s.id === value)?.name ?? "";
      return Promise.reject(new Error(t("OrgChart:Error:HeadsOther", name, headed.name)));
    },
  };
}

/**
 * The same refusals the server makes (OrgChart:0001/0002/0005), checked as the
 * user types so the dialog says what is wrong before a round trip.
 */
export function unitFormRules(index: OrgChartIndex, selfUnitId: string | null) {
  const nameRules: Rule[] = [
    { required: true, whitespace: true, message: t("OrgChart:Required:Name") },
    {
      validator: (_, value?: string) => {
        const needle = normalizeUnitName(value ?? "");
        const taken = needle && others(index, selfUnitId).some((u) => normalizeUnitName(u.name) === needle);
        return taken ? Promise.reject(new Error(t("OrgChart:Error:DuplicateName"))) : Promise.resolve();
      },
    },
  ];

  const codeRules: Rule[] = [
    {
      validator: (_, value?: string) => {
        const code = value?.trim().toLowerCase();
        const taken = code && others(index, selfUnitId).some((u) => u.code.toLowerCase() === code);
        return taken ? Promise.reject(new Error(t("OrgChart:Error:DuplicateCode"))) : Promise.resolve();
      },
    },
  ];

  return {
    name: nameRules,
    code: codeRules,
    head: [{ required: true, message: t("OrgChart:Required:Head") }, headConflictRule(index, selfUnitId)] as Rule[],
    parent: [{ required: true, message: t("OrgChart:Required:Parent") }] as Rule[],
  };
}

/** Existing names close to what is typed — the BA asks to show them so a clash is seen early. */
export function nameSuggestions(index: OrgChartIndex, typed: string, selfUnitId: string | null) {
  const needle = normalizeUnitName(typed);
  if (!needle) return [];
  return others(index, selfUnitId)
    .filter((u) => u.kind !== ORG_UNIT_KIND.Root && normalizeUnitName(u.name).includes(needle))
    .slice(0, 8)
    .map((u) => ({ value: u.name }));
}
