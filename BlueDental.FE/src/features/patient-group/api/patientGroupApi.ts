import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patientRelationKeys } from "@/hooks/usePatientFamily";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";
import type { GroupKind, PatientGroupDetailDto, PatientGroupDto, SavePatientGroupInput } from "../types";

/** Hồ sơ nhóm (4.10). The server keeps every rule: members of the branch, one family per record, one head. */

const BASE = "/v1/app/patient-groups";

export interface GroupListFilter {
  filter: string;
  kind: GroupKind | undefined;
  skipCount: number;
  maxResultCount: number;
}

/** Shares the root with the patient record's "by-patient" query, so a write refreshes both. */
export const patientGroupKeys = {
  all: ["patient-groups"] as const,
  list: (filter: GroupListFilter) => [...patientGroupKeys.all, "list", filter] as const,
  detail: (id: string) => [...patientGroupKeys.all, "detail", id] as const,
};

export function usePatientGroups(filter: GroupListFilter) {
  return useQuery({
    queryKey: patientGroupKeys.list(filter),
    queryFn: async () =>
      (
        await api.get<PagedResult<PatientGroupDto>>(BASE, {
          params: {
            Filter: filter.filter || undefined,
            Kind: filter.kind,
            SkipCount: filter.skipCount,
            MaxResultCount: filter.maxResultCount,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

export function usePatientGroup(id: string | null) {
  return useQuery({
    queryKey: patientGroupKeys.detail(id ?? "none"),
    queryFn: async () => (await api.get<PatientGroupDetailDto>(`${BASE}/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function usePatientGroupCommands() {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: patientGroupKeys.all });
    // A family group makes its members người nhà of each other.
    await queryClient.invalidateQueries({ queryKey: patientRelationKeys.all });
  };

  const create = useMutation({
    mutationFn: (input: SavePatientGroupInput) => api.post<PatientGroupDetailDto>(BASE, input).then((r) => r.data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: SavePatientGroupInput }) =>
      api.put<PatientGroupDetailDto>(`${BASE}/${id}`, input).then((r) => r.data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
