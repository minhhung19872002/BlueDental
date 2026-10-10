import { t } from "@/lib/i18n";
import {
  ORG_UNIT_KIND,
  type OrgChartDto,
  type OrgStaffDto,
  type OrgUnitDto,
  type OrgUnitKind,
} from "../../api/orgChartApi";

export type OrgKindModifier = "root" | "dept" | "team";

/**
 * Per kind: CSS modifier, kind label, the head's title ("Trưởng team"), and the
 * short scope badge. The legend, nodes, avatars and badges share them.
 */
export const ORG_KIND_CONFIG: Record<
  OrgUnitKind,
  { modifier: OrgKindModifier; labelKey: string; roleKey: string; scopeBadgeKey: string }
> = {
  [ORG_UNIT_KIND.Root]: {
    modifier: "root",
    labelKey: "OrgChart:Kind:Root",
    roleKey: "OrgChart:Role:Root",
    scopeBadgeKey: "OrgChart:ScopeBadge:Root",
  },
  [ORG_UNIT_KIND.Department]: {
    modifier: "dept",
    labelKey: "OrgChart:Kind:Department",
    roleKey: "OrgChart:Role:Department",
    scopeBadgeKey: "OrgChart:ScopeBadge:Department",
  },
  [ORG_UNIT_KIND.DoctorTeam]: {
    modifier: "team",
    labelKey: "OrgChart:Kind:DoctorTeam",
    roleKey: "OrgChart:Role:DoctorTeam",
    scopeBadgeKey: "OrgChart:ScopeBadge:Team",
  },
};

/** What the head of each kind sees on Lịch làm việc / Chấm công (BA 2026-10-10). */
export const ORG_SCOPE_KEY: Record<OrgUnitKind, string> = {
  [ORG_UNIT_KIND.Root]: "OrgChart:Scope:Root",
  [ORG_UNIT_KIND.Department]: "OrgChart:Scope:Department",
  [ORG_UNIT_KIND.DoctorTeam]: "OrgChart:Scope:Team",
};

/** The same comparison the server makes for "Tên đơn vị": case and stray spaces aside, accents kept. */
export function normalizeUnitName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

/** Whether a unit may sit under a parent of `parentKind` — mirrors OrgUnit.ParentFits. */
export function parentFits(kind: OrgUnitKind, parentKind: OrgUnitKind): boolean {
  if (kind === ORG_UNIT_KIND.Department) return parentKind === ORG_UNIT_KIND.Root;
  if (kind === ORG_UNIT_KIND.DoctorTeam) {
    return parentKind === ORG_UNIT_KIND.Root || parentKind === ORG_UNIT_KIND.Department;
  }
  return false;
}

export interface OrgChartIndex {
  root: OrgUnitDto | undefined;
  units: OrgUnitDto[];
  byId: Map<string, OrgUnitDto>;
  childrenOf: (unitId: string) => OrgUnitDto[];
  /** The unit a person belongs to (their đơn vị chính). */
  unitOfStaff: Map<string, OrgUnitDto>;
  /** The unit a person heads. */
  headedBy: Map<string, OrgUnitDto>;
  /** Every active person on the chart, placed or not. */
  activeStaff: OrgStaffDto[];
  unassigned: OrgStaffDto[];
}

export function indexOrgChart(chart: OrgChartDto | undefined): OrgChartIndex {
  const units = chart?.units ?? [];
  const byId = new Map(units.map((u) => [u.id, u]));
  const children = new Map<string, OrgUnitDto[]>();
  const unitOfStaff = new Map<string, OrgUnitDto>();
  const headedBy = new Map<string, OrgUnitDto>();
  const staff = new Map<string, OrgStaffDto>();

  for (const unit of units) {
    if (unit.parentId) children.set(unit.parentId, [...(children.get(unit.parentId) ?? []), unit]);
    if (unit.headStaffId) headedBy.set(unit.headStaffId, unit);
    for (const member of unit.members) {
      unitOfStaff.set(member.id, unit);
      staff.set(member.id, member);
    }
  }
  for (const person of chart?.unassigned ?? []) staff.set(person.id, person);

  return {
    root: units.find((u) => u.kind === ORG_UNIT_KIND.Root),
    units,
    byId,
    childrenOf: (unitId) => children.get(unitId) ?? [],
    unitOfStaff,
    headedBy,
    activeStaff: [...staff.values()].filter((s) => s.isActive),
    unassigned: chart?.unassigned ?? [],
  };
}

/** Every unit under `unitId`, at any depth. */
export function descendantsOf(index: OrgChartIndex, unitId: string): OrgUnitDto[] {
  const direct = index.childrenOf(unitId);
  return direct.flatMap((child) => [child, ...descendantsOf(index, child.id)]);
}

export interface OrgUnitSize {
  members: number;
  dentists: number;
  teams: number;
  departments: number;
}

/** Head-count of a unit and everything under it — the node footer and "Quy mô". */
export function sizeOf(index: OrgChartIndex, unit: OrgUnitDto): OrgUnitSize {
  const all = [unit, ...descendantsOf(index, unit.id)];
  const people = all.flatMap((u) => u.members);
  return {
    members: people.length,
    dentists: people.filter((p) => p.isDentist).length,
    teams: all.filter((u) => u.kind === ORG_UNIT_KIND.DoctorTeam).length,
    departments: all.filter((u) => u.kind === ORG_UNIT_KIND.Department).length,
  };
}

/** Matches the toolbar search: unit name/code or anyone in it. */
export function unitMatches(unit: OrgUnitDto, needle: string): boolean {
  if (!needle) return false;
  const haystack = [unit.name, unit.code, ...unit.members.map((m) => m.name)];
  return haystack.some((text) => normalizeUnitName(text).includes(needle));
}

export function headOf(unit: OrgUnitDto): OrgStaffDto | undefined {
  return unit.members.find((m) => m.id === unit.headStaffId);
}

/** The head-count line shown on a node and as "Quy mô" in the detail panel. */
export function sizeLine(unit: OrgUnitDto, size: OrgUnitSize): string {
  if (unit.kind === ORG_UNIT_KIND.Root) return t("OrgChart:Node:RootSize", size.departments, size.teams);
  if (unit.kind === ORG_UNIT_KIND.Department) return t("OrgChart:Node:DepartmentSize", size.teams, size.members);
  return t("OrgChart:Node:TeamSize", size.members);
}
