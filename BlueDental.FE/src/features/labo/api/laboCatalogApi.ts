import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useBranchFilter, useCurrentBranchId } from "@/lib/clinicBranch";
import type { PagedResult } from "@/types";

/**
 * Nhà cung cấp Labo and Dịch vụ - vật liệu.
 *
 * Both lists are searched, filtered and paged on the server — the reference
 * narrows them with a request, not by hiding rows it already fetched, and a
 * client-side filter would only ever search the page in hand.
 */

// ── Nhà cung cấp Labo ──────────────────────────────────────────────────

const SUPPLIER_BASE = "/v1/app/labo-suppliers";

export interface LaboSupplierDto {
  id: string;
  clinicBranchId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  contactPerson?: string | null;
  taxCode?: string | null;
  address?: string | null;
  provinceCode?: string | null;
  wardCode?: string | null;
  logoFileId?: string | null;
  logoPath?: string | null;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string | null;
}

/** What the dialog sends. The reference saves the whole form at once. */
export interface LaboSupplierInput {
  name: string;
  email: string;
  phone?: string;
  contactPerson?: string;
  taxCode?: string;
  provinceCode?: string;
  wardCode?: string;
  address?: string;
}

export interface LaboSupplierQuery {
  filter?: string;
  skipCount: number;
  maxResultCount: number;
}

export const laboSupplierKeys = {
  all: ["labo-suppliers"] as const,
  list: (branchId: string | undefined, query: LaboSupplierQuery) =>
    [
      ...laboSupplierKeys.all,
      branchId ?? "all",
      query.filter?.trim() ?? "",
      query.skipCount,
      query.maxResultCount,
    ] as const,
};

export function useLaboSupplierList(query: LaboSupplierQuery) {
  const clinicBranchId = useBranchFilter();

  return useQuery({
    queryKey: laboSupplierKeys.list(clinicBranchId, query),
    queryFn: async (): Promise<PagedResult<LaboSupplierDto>> => {
      const response = await api.get<PagedResult<LaboSupplierDto>>(SUPPLIER_BASE, {
        params: {
          ClinicBranchId: clinicBranchId,
          Filter: query.filter?.trim() || undefined,
          SkipCount: query.skipCount,
          MaxResultCount: query.maxResultCount,
        },
      });
      return response.data;
    },
    placeholderData: (previous) => previous,
  });
}

/**
 * The logo has endpoints of its own rather than travelling in the form: it is
 * a file, the record is saved as JSON, and a form posted without one would
 * otherwise blank a logo that had just been uploaded. Same shape as the staff
 * avatar.
 */
export const laboSupplierLogoApi = {
  upload: (id: string, file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ url: string }>(`${SUPPLIER_BASE}/${id}/logo`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data.url);
  },
  remove: (id: string): Promise<void> =>
    api.delete(`${SUPPLIER_BASE}/${id}/logo`).then(() => undefined),
};

export function useLaboSupplierCommands() {
  const queryClient = useQueryClient();
  const clinicBranchId = useCurrentBranchId();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: laboSupplierKeys.all });

  const create = useMutation({
    mutationFn: (input: LaboSupplierInput) =>
      api
        .post<LaboSupplierDto>(SUPPLIER_BASE, { ...input, clinicBranchId })
        .then((r) => r.data),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: LaboSupplierInput }) =>
      api.put<LaboSupplierDto>(`${SUPPLIER_BASE}/${id}`, input).then((r) => r.data),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${SUPPLIER_BASE}/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

// ── Dịch vụ - vật liệu ─────────────────────────────────────────────────

const MATERIAL_BASE = "/v1/app/labo-materials";

export interface LaboMaterialDto {
  id: string;
  clinicBranchId: string;
  taxonomyId: string;
  taxonomyName?: string | null;
  name: string;
  sortOrder: number;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string | null;
}

export interface LaboMaterialInput {
  name: string;
  taxonomyId: string;
}

export interface LaboMaterialQuery {
  taxonomyId?: string;
  filter?: string;
  skipCount: number;
  maxResultCount: number;
}

export const laboMaterialKeys = {
  all: ["labo-materials"] as const,
  list: (branchId: string | undefined, query: LaboMaterialQuery) =>
    [
      ...laboMaterialKeys.all,
      branchId ?? "all",
      query.taxonomyId ?? null,
      query.filter?.trim() ?? "",
      query.skipCount,
      query.maxResultCount,
    ] as const,
};

export function useLaboMaterialList(query: LaboMaterialQuery) {
  const clinicBranchId = useBranchFilter();

  return useQuery({
    queryKey: laboMaterialKeys.list(clinicBranchId, query),
    queryFn: async (): Promise<PagedResult<LaboMaterialDto>> => {
      const response = await api.get<PagedResult<LaboMaterialDto>>(MATERIAL_BASE, {
        params: {
          ClinicBranchId: clinicBranchId,
          TaxonomyId: query.taxonomyId,
          Filter: query.filter?.trim() || undefined,
          SkipCount: query.skipCount,
          MaxResultCount: query.maxResultCount,
        },
      });
      return response.data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useLaboMaterialCommands() {
  const queryClient = useQueryClient();
  const clinicBranchId = useCurrentBranchId();

  // A material's group carries its own count, so both lists are refreshed.
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: laboMaterialKeys.all });
    void queryClient.invalidateQueries({ queryKey: ["labo-catalog"] });
  };

  const create = useMutation({
    mutationFn: (input: LaboMaterialInput) =>
      api.post(MATERIAL_BASE, { ...input, clinicBranchId }).then(() => undefined),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: LaboMaterialInput }) =>
      api.put(`${MATERIAL_BASE}/${id}`, input).then(() => undefined),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${MATERIAL_BASE}/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
