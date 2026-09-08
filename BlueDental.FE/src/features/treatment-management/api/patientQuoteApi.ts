import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/** One line of a báo giá: the consulting line it quotes, ticked or not. */
export interface PatientQuoteLineDto {
  adviseId: string;
  isSelected: boolean;
  sortOrder: number;
}

export interface PatientQuoteDto {
  id: string;
  patientId: string;
  clinicBranchId: string;
  /** 1-based per patient; the tab reads "BG {ordinal}". */
  ordinal: number;
  creationTime: string;
  lines: PatientQuoteLineDto[];
}

export interface CreatePatientQuoteInput {
  patientId: string;
  clinicBranchId: string;
  /** In the order they should sit on the quote. All start ticked. */
  adviseIds: string[];
}

const BASE = "/v1/app/patient-quotes";

const patientQuoteApi = {
  list: (params: {
    patientId: string;
    clinicBranchId?: string;
    maxResultCount?: number;
  }): Promise<PagedResult<PatientQuoteDto>> =>
    api.get<PagedResult<PatientQuoteDto>>(BASE, { params }).then((r) => r.data),

  create: (input: CreatePatientQuoteInput): Promise<PatientQuoteDto> =>
    api.post<PatientQuoteDto>(BASE, input).then((r) => r.data),

  duplicate: (id: string): Promise<PatientQuoteDto> =>
    api.post<PatientQuoteDto>(`${BASE}/${id}/duplicate`).then((r) => r.data),

  /** The whole set, as a re-tick or a drag leaves it; the server renumbers it. */
  update: (id: string, lines: PatientQuoteLineDto[]): Promise<PatientQuoteDto> =>
    api.put<PatientQuoteDto>(`${BASE}/${id}`, { lines }).then((r) => r.data),

  remove: (id: string): Promise<void> => api.delete(`${BASE}/${id}`).then(() => undefined),
};

export const patientQuoteKeys = {
  all: ["patient-quotes"] as const,
  list: (patientId: string, branchId?: string) =>
    [...patientQuoteKeys.all, "list", patientId, branchId ?? ""] as const,
};

export function usePatientQuotes(patientId: string, branchId?: string) {
  return useQuery({
    queryKey: patientQuoteKeys.list(patientId, branchId),
    queryFn: () =>
      patientQuoteApi.list({ patientId, clinicBranchId: branchId, maxResultCount: 50 }),
    enabled: Boolean(patientId) && Boolean(branchId),
  });
}

/** Every quote write reloads the strip: numbering and order are the server's. */
function useQuoteMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientQuoteKeys.all });
    },
  });
}

export function useCreatePatientQuote() {
  return useQuoteMutation((input: CreatePatientQuoteInput) => patientQuoteApi.create(input));
}

export function useDuplicatePatientQuote() {
  return useQuoteMutation((id: string) => patientQuoteApi.duplicate(id));
}

export function useUpdatePatientQuote() {
  return useQuoteMutation((input: { id: string; lines: PatientQuoteLineDto[] }) =>
    patientQuoteApi.update(input.id, input.lines),
  );
}

export function useDeletePatientQuote() {
  return useQuoteMutation((id: string) => patientQuoteApi.remove(id));
}
