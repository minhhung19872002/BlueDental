import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";
import type {
  CreateStaffNoteInput,
  StaffNoteDto,
  StaffNoteListQuery,
  UpdateStaffNoteInput,
} from "../types";

const BASE = "/v1/app/staff-notes";

export const staffNoteKeys = {
  all: ["staff-notes"] as const,
  list: (branchId: string | null, query: StaffNoteListQuery) =>
    [...staffNoteKeys.all, "list", branchId ?? "all", query] as const,
};

/**
 * One page of notes. "Chung" follows the branch picked in the header (all the
 * account's branches when none is), so the branch is part of the key even
 * though the request names it through the header.
 */
export function useStaffNotes(branchId: string | null, query: StaffNoteListQuery) {
  return useQuery({
    queryKey: staffNoteKeys.list(branchId, query),
    queryFn: () =>
      api.get<PagedResult<StaffNoteDto>>(BASE, { params: query }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateNotes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: staffNoteKeys.all });
}

export function useCreateStaffNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (input: CreateStaffNoteInput) =>
      api.post<StaffNoteDto>(BASE, input).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useUpdateStaffNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: ({ id, content }: UpdateStaffNoteInput) =>
      api.put<StaffNoteDto>(`${BASE}/${id}`, { content }).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useDeleteStaffNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });
}
