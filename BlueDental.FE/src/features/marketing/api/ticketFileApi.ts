import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useBranchFilter, useCurrentBranchId } from "@/lib/clinicBranch";
import { downloadFile } from "@/lib/download";
import type { PagedResult } from "@/types";
import { ticketKeys, type TicketStats } from "./ticketApi";

/**
 * Marketing → Ticket File (BA 8.4): Excel files imported into tickets, and how
 * far each file's tickets got. The server checks the whole file before it
 * writes anything — docs/clone/pages/marketing-ticket.md.
 */

const FILE_BASE = "/v1/app/marketing-ticket-files";

export interface TicketImportFileDto {
  id: string;
  clinicBranchId: string;
  fileName: string;
  rowCount: number;
  createdCount: number;
  reoccurredCount: number;
  sourceTaxonomyId?: string | null;
  sourceEntryId?: string | null;
  tagIds: string[];
  assigneeNames: string[];
  /** The file's live tickets today, per status. */
  progress: TicketStats;
  creatorName?: string | null;
  creationTime: string;
}

/** 1-based column of the file holding each ticket field; Họ tên and Số điện thoại are required. */
export interface TicketFileMapping {
  fullName?: number;
  phone?: number;
  email?: number;
  note?: number;
}

export interface TicketFileHeaders {
  /** Header text by column, from column 1. */
  headers: string[];
  rowCount: number;
  suggested: TicketFileMapping;
}

export interface TicketImportOptions {
  mapping: TicketFileMapping;
  sourceTaxonomyId?: string;
  sourceEntryId?: string;
  tagIds: string[];
  /** Dealt the new tickets in turn; empty leaves them in the pool. */
  assigneeIds: string[];
}

export interface TicketImportRowError {
  row: number;
  errors: string[];
}

export interface TicketImportResult {
  /** False when the file was refused for its row errors — nothing was written. */
  committed: boolean;
  rowCount: number;
  createdCount: number;
  reoccurredCount: number;
  errors: TicketImportRowError[];
  file?: TicketImportFileDto | null;
}

export interface TicketFileQuery {
  filter?: string;
  skipCount: number;
  maxResultCount: number;
}

export const ticketFileKeys = {
  all: ["marketing-ticket-files"] as const,
  list: (branchId: string | undefined, query: TicketFileQuery) => [...ticketFileKeys.all, "list", branchId ?? "all", query] as const,
  detail: (id: string) => [...ticketFileKeys.all, "detail", id] as const,
};

export function useTicketFiles(query: TicketFileQuery) {
  const branchId = useBranchFilter();
  return useQuery({
    queryKey: ticketFileKeys.list(branchId, query),
    queryFn: async () =>
      (
        await api.get<PagedResult<TicketImportFileDto>>(FILE_BASE, {
          params: {
            ClinicBranchId: branchId,
            Filter: query.filter?.trim() || undefined,
            SkipCount: query.skipCount,
            MaxResultCount: query.maxResultCount,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  });
}

export function useTicketFile(id: string | undefined) {
  return useQuery({
    queryKey: ticketFileKeys.detail(id ?? ""),
    queryFn: async () => (await api.get<TicketImportFileDto>(`${FILE_BASE}/${id}`)).data,
    enabled: Boolean(id),
  });
}

/** The multipart body of an import: one field per column, repeated fields for the lists. */
function importForm(file: File, branchId: string, options: TicketImportOptions): FormData {
  const form = new FormData();
  form.append("file", file);
  form.append("clinicBranchId", branchId);
  const columns: [string, number | undefined][] = [
    ["fullNameColumn", options.mapping.fullName],
    ["phoneColumn", options.mapping.phone],
    ["emailColumn", options.mapping.email],
    ["noteColumn", options.mapping.note],
  ];
  for (const [name, column] of columns) if (column) form.append(name, String(column));
  if (options.sourceTaxonomyId) form.append("sourceTaxonomyId", options.sourceTaxonomyId);
  if (options.sourceEntryId) form.append("sourceEntryId", options.sourceEntryId);
  options.tagIds.forEach((id) => form.append("tagIds", id));
  options.assigneeIds.forEach((id) => form.append("assigneeIds", id));
  return form;
}

/** Template downloads the sample file; inspect reads an upload's header row; commit imports it into the current branch. */
export function useTicketFileCommands() {
  const queryClient = useQueryClient();
  const branchId = useCurrentBranchId();

  const template = useMutation({
    mutationFn: (fallbackName: string) => downloadFile(`${FILE_BASE}/template`, fallbackName),
  });
  const inspect = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post<TicketFileHeaders>(`${FILE_BASE}/inspect`, form).then((r) => r.data);
    },
  });
  const commit = useMutation({
    mutationFn: ({ file, options }: { file: File; options: TicketImportOptions }) =>
      api.post<TicketImportResult>(FILE_BASE, importForm(file, branchId, options)).then((r) => r.data),
    onSuccess: (result) => {
      if (!result.committed) return;
      void queryClient.invalidateQueries({ queryKey: ticketFileKeys.all });
      void queryClient.invalidateQueries({ queryKey: ticketKeys.all });
    },
  });

  return { template, inspect, commit };
}
