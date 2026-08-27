import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useBranchFilter, useCurrentBranchId } from "@/lib/clinicBranch";

/**
 * The groups of one taxonomy collection.
 *
 * Danh mục files its catalogs under these, and Vật tư files its materials under
 * the same collection with `group=supplies` — the reference does exactly that,
 * fetching `/taxonomy/?group=supplies` for the panel beside the material list.
 * So the calls live here rather than inside either feature.
 *
 * Danh mục keeps its own copy for now: it is a finished screen with tests
 * around it (see CLAUDE.md §17), and moving its data layer is a bigger change
 * than this needs. Worth folding together the next time that screen is opened.
 */
export interface TaxonomyGroup {
  id: string;
  clinicBranchId: string;
  group: string;
  name: string;
  sortOrder: number;
  entryCount?: number;
  /** Seeded groups the reference marks and refuses to rename or delete. */
  isSystem?: boolean;
}

const BASE = "/v1/app/taxonomies";

export function taxonomyGroupKeys(group: string, branchId?: string, filter?: string) {
  return ["taxonomy-groups", group, branchId, filter] as const;
}

export function useTaxonomyGroups(group: string, filter?: string) {
  const clinicBranchId = useBranchFilter();

  return useQuery({
    queryKey: taxonomyGroupKeys(group, clinicBranchId, filter),
    queryFn: async (): Promise<TaxonomyGroup[]> => {
      const response = await api.get(BASE, {
        params: {
          ClinicBranchId: clinicBranchId,
          Group: group,
          Filter: filter || undefined,
          IncludeCount: true,
          MaxResultCount: 200,
        },
      });
      return response.data?.items ?? [];
    },
  });
}

/** Create, rename, remove and reorder, all invalidating the one list. */
export function useTaxonomyGroupCommands(group: string) {
  const queryClient = useQueryClient();
  const clinicBranchId = useCurrentBranchId();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["taxonomy-groups", group] });

  const create = useMutation({
    mutationFn: (input: { name: string; sortOrder: number }) =>
      api
        .post(BASE, { clinicBranchId, group, name: input.name, sortOrder: input.sortOrder })
        .then((r) => r.data as TaxonomyGroup),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (input: { id: string; name: string; sortOrder: number }) =>
      api
        .put(`${BASE}/${input.id}`, { name: input.name, sortOrder: input.sortOrder })
        .then((r) => r.data as TaxonomyGroup),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });

  /** One drag is one call carrying the whole order, as the catalog does it. */
  const reorder = useMutation({
    mutationFn: (ids: string[]) =>
      api.post(`${BASE}/reorder`, { clinicBranchId, group, ids }).then(() => undefined),
    onSuccess: invalidate,
  });

  return { create, update, remove, reorder };
}
