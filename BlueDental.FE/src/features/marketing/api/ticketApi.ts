import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useBranchFilter, useCurrentBranchId } from "@/lib/clinicBranch";
import type { PagedResult } from "@/types";

/**
 * Marketing → Ticket (F-51). BlueDental-local — docs/clone/pages/marketing-ticket.md:
 * the reference has no such screen. Filtering, paging, the status workflow and
 * who may see which ticket are all the server's.
 */

const TICKET_BASE = "/v1/app/marketing-tickets";

/** Mirrors BlueDental.Marketing.TicketStatus. */
export const TICKET_STATUS = { New: 1, InCare: 2, Booked: 3, Arrived: 4, NotPotential: 5 } as const;
export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

/** Mirrors BlueDental.Marketing.TicketChannel. */
export const TICKET_CHANNEL = { Manual: 1, File: 2, Website: 3 } as const;
export type TicketChannel = (typeof TICKET_CHANNEL)[keyof typeof TICKET_CHANNEL];

/** Mirrors BlueDental.Marketing.TicketContactResult. */
export const CONTACT_RESULT = { Interested: 1, NoNeed: 2, NoAnswer: 3, Unreachable: 4, CallBack: 5 } as const;
export type ContactResult = (typeof CONTACT_RESULT)[keyof typeof CONTACT_RESULT];

/** Mirrors BlueDental.Marketing.TicketActivityKind. */
export const ACTIVITY_KIND = {
  Created: 1,
  Contact: 2,
  StatusChanged: 3,
  Assigned: 4,
  Reoccurred: 5,
  Booked: 6,
  AppointmentChanged: 7,
  Deleted: 8,
  Restored: 9,
} as const;
export type ActivityKind = (typeof ACTIVITY_KIND)[keyof typeof ACTIVITY_KIND];

export interface TicketDto {
  id: string;
  clinicBranchId: string;
  code: string;
  fullName: string;
  phone: string;
  email?: string | null;
  note?: string | null;
  sourceTaxonomyId?: string | null;
  sourceEntryId?: string | null;
  channel: TicketChannel;
  assigneeId?: string | null;
  assigneeName?: string | null;
  assignedAt?: string | null;
  receivedAt: string;
  patientId?: string | null;
  patientCode?: string | null;
  isReturningCustomer: boolean;
  appointmentId?: string | null;
  appointmentStart?: string | null;
  status: TicketStatus;
  processingDays?: number | null;
  dueAt?: string | null;
  isOverdue: boolean;
  contactCount: number;
  lastContactAt?: string | null;
  lastContactResult?: ContactResult | null;
  nextCallAt?: string | null;
  notPotentialReason?: string | null;
  tagIds: string[];
  creatorName?: string | null;
  creationTime: string;
  isDeleted: boolean;
  deleteReason?: string | null;
  deletionTime?: string | null;
  deleterName?: string | null;
}

export interface TicketActivityDto {
  id: string;
  kind: ActivityKind;
  contactResult?: ContactResult | null;
  fromStatus?: TicketStatus | null;
  toStatus?: TicketStatus | null;
  note?: string | null;
  nextCallAt?: string | null;
  assigneeName?: string | null;
  appointmentId?: string | null;
  creatorName?: string | null;
  creationTime: string;
}

export interface TicketStats {
  total: number;
  new: number;
  inCare: number;
  booked: number;
  arrived: number;
  notPotential: number;
  overdue: number;
  callBackDue: number;
}

/** What the list and the KPI strip are filtered by. Saved filters store exactly this. */
export interface TicketFilter {
  filter?: string;
  statuses?: TicketStatus[];
  tagId?: string;
  /** A staff id, or "pool" for the unassigned tickets. */
  assignee?: string;
  sourceTaxonomyId?: string;
  sourceEntryId?: string;
  channel?: TicketChannel;
  fromDate?: string;
  toDate?: string;
  overdueOnly?: boolean;
  callBackDue?: boolean;
  returningCustomer?: boolean;
}

export interface TicketQuery extends TicketFilter {
  deleted?: boolean;
  skipCount: number;
  maxResultCount: number;
}

export interface TicketInput {
  fullName: string;
  phone: string;
  email?: string | null;
  note?: string | null;
  sourceTaxonomyId?: string | null;
  sourceEntryId?: string | null;
  tagIds: string[];
}

export interface CreateTicketInput extends TicketInput {
  assigneeId?: string | null;
}

export interface CreateTicketResult {
  ticket: TicketDto;
  reoccurred: boolean;
}

export interface ContactInput {
  result: ContactResult;
  note?: string | null;
  nextCallAt?: string | null;
}

export interface BookInput {
  dentistId?: string | null;
  slotStart: string;
  slotEnd: string;
  notes?: string | null;
}

export const ticketKeys = {
  all: ["marketing-tickets"] as const,
  list: (branchId: string | undefined, query: TicketQuery) => [...ticketKeys.all, "list", branchId ?? "all", query] as const,
  stats: (branchId: string | undefined, filter: TicketFilter) => [...ticketKeys.all, "stats", branchId ?? "all", filter] as const,
  detail: (id: string) => [...ticketKeys.all, "detail", id] as const,
  activities: (id: string) => [...ticketKeys.all, "activities", id] as const,
};

/** The server's GetTicketListInput, from the screen's filter. */
function toParams(branchId: string | undefined, filter: TicketFilter) {
  return {
    ClinicBranchId: branchId,
    Filter: filter.filter?.trim() || undefined,
    Statuses: filter.statuses?.length ? filter.statuses : undefined,
    TagId: filter.tagId,
    AssigneeId: filter.assignee && filter.assignee !== "pool" ? filter.assignee : undefined,
    Unassigned: filter.assignee === "pool" || undefined,
    SourceTaxonomyId: filter.sourceTaxonomyId,
    SourceEntryId: filter.sourceEntryId,
    Channel: filter.channel,
    FromDate: filter.fromDate,
    ToDate: filter.toDate,
    OverdueOnly: filter.overdueOnly || undefined,
    CallBackDue: filter.callBackDue || undefined,
    ReturningCustomer: filter.returningCustomer,
  };
}

export function useTicketList(query: TicketQuery) {
  const branchId = useBranchFilter();
  return useQuery({
    queryKey: ticketKeys.list(branchId, query),
    queryFn: async () =>
      (
        await api.get<PagedResult<TicketDto>>(TICKET_BASE, {
          params: {
            ...toParams(branchId, query),
            Deleted: query.deleted || undefined,
            SkipCount: query.skipCount,
            MaxResultCount: query.maxResultCount,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

/** The KPI strip counts every status under the other filters, so its own status pick is left out. */
export function useTicketStats(filter: TicketFilter) {
  const branchId = useBranchFilter();
  const withoutStatus: TicketFilter = { ...filter, statuses: undefined, overdueOnly: undefined, callBackDue: undefined };
  return useQuery({
    queryKey: ticketKeys.stats(branchId, withoutStatus),
    queryFn: async () => (await api.get<TicketStats>(`${TICKET_BASE}/stats`, { params: toParams(branchId, withoutStatus) })).data,
    placeholderData: keepPreviousData,
  });
}

export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: ticketKeys.detail(id ?? ""),
    queryFn: async () => (await api.get<TicketDto>(`${TICKET_BASE}/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function useTicketActivities(id: string | undefined) {
  return useQuery({
    queryKey: ticketKeys.activities(id ?? ""),
    queryFn: async () => (await api.get<TicketActivityDto[]>(`${TICKET_BASE}/${id}/activities`)).data,
    enabled: Boolean(id),
  });
}

export function useTicketCommands() {
  const queryClient = useQueryClient();
  const clinicBranchId = useCurrentBranchId();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ticketKeys.all });
  const post = <T>(id: string, action: string, body?: T) =>
    api.post<TicketDto>(`${TICKET_BASE}/${id}/${action}`, body).then((r) => r.data);

  const create = useMutation({
    mutationFn: (input: CreateTicketInput) =>
      api.post<CreateTicketResult>(TICKET_BASE, { ...input, clinicBranchId }).then((r) => r.data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TicketInput }) =>
      api.put<TicketDto>(`${TICKET_BASE}/${id}`, input).then((r) => r.data),
    onSuccess: invalidate,
  });
  const contact = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ContactInput }) => post(id, "contacts", input),
    onSuccess: invalidate,
  });
  const claim = useMutation({ mutationFn: (id: string) => post(id, "claim"), onSuccess: invalidate });
  const assign = useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string | null }) => post(id, "assign", { assigneeId }),
    onSuccess: invalidate,
  });
  const notPotential = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => post(id, "not-potential", { reason }),
    onSuccess: invalidate,
  });
  const reopen = useMutation({ mutationFn: (id: string) => post(id, "reopen"), onSuccess: invalidate });
  const book = useMutation({
    mutationFn: ({ id, input }: { id: string; input: BookInput }) => post(id, "appointments", input),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.delete(`${TICKET_BASE}/${id}`, { data: { reason } }).then(() => undefined),
    onSuccess: invalidate,
  });
  const restore = useMutation({ mutationFn: (id: string) => post(id, "restore"), onSuccess: invalidate });

  return { create, update, contact, claim, assign, notPotential, reopen, book, remove, restore };
}
