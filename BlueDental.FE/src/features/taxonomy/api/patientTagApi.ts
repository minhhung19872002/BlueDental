import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/** Mirrors BlueDental.Catalogs.PatientTagDto. */
export interface PatientTagDto {
  id: string;
  clinicBranchId: string;
  name: string;
  color: string;
  description: string | null;
  isActive: boolean;
  lastModificationTime: string | null;
  creationTime: string;
}

export interface CreatePatientTagInput {
  clinicBranchId: string;
  name: string;
  color: string;
  description?: string;
}

export interface UpdatePatientTagInput {
  name: string;
  color: string;
  description?: string;
  isActive: boolean;
}

export interface PatientTagQuery {
  filter?: string;
  skipCount: number;
  maxResultCount: number;
}

const patientTagApi = {
  list: (params: {
    clinicBranchId?: string;
    filter?: string;
    skipCount?: number;
    maxResultCount?: number;
  }): Promise<PagedResult<PatientTagDto>> =>
    api.get<PagedResult<PatientTagDto>>("/v1/app/patient-tags", { params }).then((r) => r.data),

  create: (input: CreatePatientTagInput): Promise<PatientTagDto> =>
    api.post<PatientTagDto>("/v1/app/patient-tags", input).then((r) => r.data),

  update: (id: string, input: UpdatePatientTagInput): Promise<PatientTagDto> =>
    api.put<PatientTagDto>(`/v1/app/patient-tags/${id}`, input).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/v1/app/patient-tags/${id}`).then(() => undefined),
};

export const patientTagKeys = {
  all: ["patient-tags"] as const,
  list: (branchId: string | undefined, query: PatientTagQuery) =>
    [
      ...patientTagKeys.all,
      branchId,
      query.filter ?? "",
      query.skipCount,
      query.maxResultCount,
    ] as const,
};

export function usePatientTags(branchId: string | undefined, query: PatientTagQuery) {
  return useQuery({
    queryKey: patientTagKeys.list(branchId, query),
    queryFn: () =>
      patientTagApi.list({
        clinicBranchId: branchId,
        filter: query.filter || undefined,
        skipCount: query.skipCount,
        maxResultCount: query.maxResultCount,
      }),
    placeholderData: (previous) => previous,
  });
}

function useTagMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientTagKeys.all });
    },
  });
}

export function useCreatePatientTag() {
  return useTagMutation((input: CreatePatientTagInput) => patientTagApi.create(input));
}

export function useUpdatePatientTag() {
  return useTagMutation(({ id, input }: { id: string; input: UpdatePatientTagInput }) =>
    patientTagApi.update(id, input),
  );
}

export function useDeletePatientTag() {
  return useTagMutation((id: string) => patientTagApi.remove(id));
}
