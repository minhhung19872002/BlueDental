import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useBranchFilter, useCurrentBranchId } from "@/lib/clinicBranch";
import type { PagedResult } from "@/types";

/**
 * Khớp cắn Labo, Đường hoàn tất and Kiểu nhịp Labo.
 *
 * All three are one flat list of names, and the reference keeps all three in
 * its shared taxonomy collection rather than in tables of their own — so this
 * talks to `/v1/app/taxonomies` with the tab's group slug, exactly as Vật tư
 * does for its own groups. One module, three tabs.
 *
 * Rows are not given a priority here: the server orders by priority and then
 * by newest-first, so leaving every row at the default puts the newest at the
 * top, which is the order the reference lists these catalogs in
 * (`orderBy=createdAt:desc`). See docs/clone/pages/labo.md §4.1.
 */

const BASE = "/v1/app/taxonomies";

export interface LaboCatalogItem {
  id: string;
  name: string;
  sortOrder: number;
  creationTime: string;
  lastModificationTime: string | null;
  /** How many rows sit inside the group; only asked for where it is shown. */
  itemCount?: number;
}

export interface LaboCatalogQuery {
  filter?: string;
  skipCount: number;
  maxResultCount: number;
}

export const laboCatalogKeys = {
  all: ["labo-catalog"] as const,
  list: (group: string, branchId: string | undefined, query: LaboCatalogQuery) =>
    [
      ...laboCatalogKeys.all,
      group,
      branchId ?? "all",
      query.filter?.trim() ?? "",
      query.skipCount,
      query.maxResultCount,
    ] as const,
};

export function useLaboCatalogList(group: string, query: LaboCatalogQuery) {
  const clinicBranchId = useBranchFilter();

  return useQuery({
    queryKey: laboCatalogKeys.list(group, clinicBranchId, query),
    queryFn: async (): Promise<PagedResult<LaboCatalogItem>> => {
      const response = await api.get<PagedResult<LaboCatalogItem>>(BASE, {
        params: {
          ClinicBranchId: clinicBranchId,
          Group: group,
          Filter: query.filter?.trim() || undefined,
          SkipCount: query.skipCount,
          MaxResultCount: query.maxResultCount,
        },
      });
      return response.data;
    },
    // Paging and typing should narrow the list in place, not blank the table.
    placeholderData: (previous) => previous,
  });
}

/**
 * Every group of the catalog, unpaged.
 *
 * The Dịch vụ - vật liệu panel and its material dialog both need the whole
 * list rather than a page of it — one to list, one to choose from.
 */
export function useLaboCatalogOptions(group: string, filter?: string) {
  const clinicBranchId = useBranchFilter();
  const term = filter?.trim() || undefined;

  return useQuery({
    queryKey: [...laboCatalogKeys.all, "options", group, clinicBranchId ?? "all", term ?? ""],
    queryFn: async (): Promise<LaboCatalogItem[]> => {
      const response = await api.get<PagedResult<LaboCatalogItem>>(BASE, {
        params: {
          ClinicBranchId: clinicBranchId,
          Group: group,
          Filter: term,
          IncludeCount: true,
          MaxResultCount: 200,
        },
      });
      return response.data.items;
    },
    enabled: Boolean(group),
    // Typing narrows the panel in place rather than blanking it.
    placeholderData: (previous) => previous,
  });
}

/** Create, rename and delete, all invalidating every list of this catalog. */
export function useLaboCatalogCommands(group: string) {
  const queryClient = useQueryClient();
  const clinicBranchId = useCurrentBranchId();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: laboCatalogKeys.all });

  const create = useMutation({
    mutationFn: ({ name, sortOrder }: { name: string; sortOrder?: number }) =>
      api.post(BASE, { clinicBranchId, group, name, sortOrder }).then(() => undefined),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, name, sortOrder }: { id: string; name: string; sortOrder: number }) =>
      // The reference sends the row's existing priority straight back on an
      // edit, so renaming never moves a row.
      api.put(`${BASE}/${id}`, { name, sortOrder }).then(() => undefined),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
