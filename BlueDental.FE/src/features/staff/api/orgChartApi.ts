import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";
import { staffKeys } from "./staffQueries";

/** Mirrors BlueDental.Staff.OrgUnitKind. */
export const ORG_UNIT_KIND = { Root: 1, Department: 2, DoctorTeam: 3 } as const;
export type OrgUnitKind = (typeof ORG_UNIT_KIND)[keyof typeof ORG_UNIT_KIND];
/** The kinds a user creates — the root is seeded and never added. */
export type CreatableOrgUnitKind = Exclude<OrgUnitKind, typeof ORG_UNIT_KIND.Root>;

/** Mirrors BlueDental.Staff.OrgChartAction. */
export const ORG_CHART_ACTIONS = [1, 2, 3, 4, 5] as const;
export type OrgChartAction = (typeof ORG_CHART_ACTIONS)[number];

export interface OrgStaffDto {
  id: string;
  name: string;
  userName: string;
  position: string | null;
  avatarUrl: string | null;
  isDentist: boolean;
  isActive: boolean;
}

export interface OrgUnitDto {
  id: string;
  code: string;
  name: string;
  kind: OrgUnitKind;
  parentId: string | null;
  headStaffId: string | null;
  /** The head comes first. */
  members: OrgStaffDto[];
  creationTime: string;
}

export interface OrgChartDto {
  units: OrgUnitDto[];
  /** Active staff who belong to no unit — "Chưa thuộc đơn vị nào". */
  unassigned: OrgStaffDto[];
}

export interface OrgUnitInput {
  name: string;
  code?: string | null;
  parentId: string;
  headStaffId: string;
  memberStaffIds: string[];
}

export interface CreateOrgUnitInput extends OrgUnitInput {
  kind: CreatableOrgUnitKind;
}

export type OrgChartChangeField = "code" | "name" | "parent" | "head" | "members";

export interface OrgUnitChange {
  field: OrgChartChangeField;
  before: string | null;
  after: string | null;
}

export interface OrgUnitChangeLogDto {
  id: string;
  orgUnitId: string;
  orgUnitName: string;
  orgUnitKind: OrgUnitKind;
  action: OrgChartAction;
  changes: OrgUnitChange[];
  actorUserId: string | null;
  actorName: string | null;
  occurredAt: string;
}

export interface OrgChartHistoryQuery {
  filter?: string;
  action?: OrgChartAction;
  fromDate?: string;
  toDate?: string;
  skipCount: number;
  maxResultCount: number;
}

const BASE = "/v1/app/org-chart";

export const orgChartKeys = {
  all: ["org-chart"] as const,
  tree: () => [...orgChartKeys.all, "tree"] as const,
  nextCode: (kind: CreatableOrgUnitKind) => [...orgChartKeys.all, "next-code", kind] as const,
  history: (query: OrgChartHistoryQuery) => [...orgChartKeys.all, "history", query] as const,
};

export function useOrgChart() {
  return useQuery({
    queryKey: orgChartKeys.tree(),
    queryFn: () => api.get<OrgChartDto>(BASE).then((r) => r.data),
  });
}

export function useOrgUnitNextCode(kind: CreatableOrgUnitKind, enabled: boolean) {
  return useQuery({
    queryKey: orgChartKeys.nextCode(kind),
    queryFn: () => api.get<{ code: string }>(`${BASE}/next-code`, { params: { kind } }).then((r) => r.data.code),
    enabled,
    staleTime: 0,
  });
}

export function useOrgChartHistory(query: OrgChartHistoryQuery, enabled: boolean) {
  return useQuery({
    queryKey: orgChartKeys.history(query),
    queryFn: () =>
      api.get<PagedResult<OrgUnitChangeLogDto>>(`${BASE}/history`, { params: query }).then((r) => r.data),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** The dialog shows a save error in its own banner, not as a toast. */
const DIALOG_ERROR = { skipGlobalErrorToast: true };

export function useOrgChartCommands() {
  const queryClient = useQueryClient();
  // A unit change moves whose schedule a dentist sees, so the staff lists refresh too.
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orgChartKeys.all }),
      queryClient.invalidateQueries({ queryKey: staffKeys.all }),
    ]);

  const create = useMutation({
    mutationFn: (input: CreateOrgUnitInput) => api.post<OrgUnitDto>(`${BASE}/units`, input).then((r) => r.data),
    onSuccess: invalidate,
    meta: DIALOG_ERROR,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: OrgUnitInput }) =>
      api.put<OrgUnitDto>(`${BASE}/units/${id}`, input).then((r) => r.data),
    onSuccess: invalidate,
    meta: DIALOG_ERROR,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/units/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });

  const changeRootHead = useMutation({
    mutationFn: (headStaffId: string | null) =>
      api.put<OrgUnitDto>(`${BASE}/root/head`, { headStaffId }).then((r) => r.data),
    onSuccess: invalidate,
  });

  const assign = useMutation({
    mutationFn: (input: { orgUnitId: string; staffIds: string[] }) =>
      api.post(`${BASE}/assign`, input).then(() => undefined),
    onSuccess: invalidate,
  });

  return { create, update, remove, changeRootHead, assign };
}
