import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useBranchFilter, useCurrentBranchId } from "@/lib/clinicBranch";
import { ticketKeys } from "./ticketApi";

/** Thẻ ticket and the branch's staff — what the Ticket screen picks from. */

const TAG_BASE = "/v1/app/marketing-ticket-tags";

export interface TicketTagDto {
  id: string;
  clinicBranchId: string;
  name: string;
  /** "#rrggbb". */
  color: string;
  /** Thời gian xử lý, in days. Null = no deadline. */
  maxProcessingDays?: number | null;
  creationTime: string;
}

export interface TicketTagInput {
  name: string;
  color: string;
  maxProcessingDays?: number | null;
}

export interface StaffOption {
  value: string;
  label: string;
}

export const ticketSupportKeys = {
  tags: (branchId: string | undefined, filter?: string) => ["marketing-ticket-tags", branchId ?? "all", filter ?? ""] as const,
  allTags: ["marketing-ticket-tags"] as const,
  staff: (branchId: string) => ["marketing-ticket-staff", branchId] as const,
};

export function useTicketTags(filter?: string) {
  const branchId = useBranchFilter();
  return useQuery({
    queryKey: ticketSupportKeys.tags(branchId, filter),
    queryFn: async () =>
      (
        await api.get<{ items: TicketTagDto[] }>(TAG_BASE, {
          params: { ClinicBranchId: branchId, Filter: filter?.trim() || undefined },
        })
      ).data.items,
  });
}

export function useTicketTagCommands() {
  const queryClient = useQueryClient();
  const clinicBranchId = useCurrentBranchId();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ticketSupportKeys.allTags });
    void queryClient.invalidateQueries({ queryKey: ticketKeys.all });
  };

  const create = useMutation({
    mutationFn: (input: TicketTagInput) =>
      api.post<TicketTagDto>(TAG_BASE, { ...input, clinicBranchId }).then((r) => r.data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TicketTagInput }) =>
      api.put<TicketTagDto>(`${TAG_BASE}/${id}`, input).then((r) => r.data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${TAG_BASE}/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

/**
 * Staff working at the current branch — the only ones a ticket there may be
 * given to. Marketing's own list: /staff needs staff.read, which a marketing
 * account seldom has.
 */
export function useTicketStaffOptions(enabled = true) {
  const branchId = useCurrentBranchId();
  return useQuery({
    queryKey: ticketSupportKeys.staff(branchId),
    queryFn: async (): Promise<StaffOption[]> => {
      const response = await api.get<{ items: { id: string; name: string }[] }>("/v1/app/marketing-tickets/assignees", {
        params: { clinicBranchId: branchId },
      });
      return response.data.items.map((row) => ({ value: row.id, label: row.name }));
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
