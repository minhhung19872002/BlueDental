import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import type { PagedResult } from "@/types";
import { catalogOptionKeys } from "./useCatalogOptions";

/**
 * Vật liệu nha khoa (catalog `dental_material`, clinic 2026-10-16), read and
 * written from outside Danh mục: mẫu 5 lists the crown and implant types under
 * "Loại" and adds or corrects one in place. Danh mục owns the catalog's management; this
 * is the shared slice the medical record needs, so it lives with the shared
 * hooks and goes through the same catalog endpoints.
 */

const GROUP = "dental_material";

/** Mirrors BlueDental.Catalogs.RestorationKind. */
export const RESTORATION_MATERIAL_KIND = { Crown: 1, Implant: 2 } as const;
export type RestorationMaterialKind =
  (typeof RESTORATION_MATERIAL_KIND)[keyof typeof RESTORATION_MATERIAL_KIND];

export interface RestorationMaterial {
  id: string;
  name: string;
  kind: RestorationMaterialKind;
  brand: string | null;
  origin: string | null;
  warranty: string | null;
  /** Kept for the update round-trip; the sheet does not show them. */
  taxonomyId: string;
  sortOrder: number;
  isActive: boolean;
  code: string | null;
}

export interface RestorationMaterialInput {
  kind: RestorationMaterialKind;
  name: string;
  brand: string | null;
  origin: string | null;
  warranty: string | null;
}

interface EntryResponse {
  id: string;
  name: string;
  code: string | null;
  taxonomyId: string;
  sortOrder: number;
  isActive: boolean;
  isDeleted: boolean;
  restoration?: { kind: RestorationMaterialKind; brand: string | null; origin: string | null; warranty: string | null } | null;
}

interface TaxonomyResponse {
  id: string;
  subGroup: string | null;
}

const keyOf = (branchId: string) => [...catalogOptionKeys.group(branchId, GROUP), "materials"] as const;

/** The live (not soft-deleted) crown and implant types of the branch, in the catalog's order. */
export function useRestorationMaterials() {
  const branchId = useCurrentBranchId();

  return useQuery({
    queryKey: keyOf(branchId),
    queryFn: async (): Promise<RestorationMaterial[]> => {
      const page = await api
        .get<PagedResult<EntryResponse>>("/v1/app/catalog-entries", {
          params: { clinicBranchId: branchId, group: GROUP, isDeleted: false, maxResultCount: 500 },
        })
        .then((r) => r.data);

      return page.items.map((entry) => ({
        id: entry.id,
        name: entry.name,
        kind: entry.restoration?.kind ?? RESTORATION_MATERIAL_KIND.Crown,
        brand: entry.restoration?.brand ?? null,
        origin: entry.restoration?.origin ?? null,
        warranty: entry.restoration?.warranty ?? null,
        taxonomyId: entry.taxonomyId,
        sortOrder: entry.sortOrder,
        isActive: entry.isActive,
        code: entry.code,
      }));
    },
    enabled: Boolean(branchId),
  });
}

/**
 * The fixed group a kind is filed under — "Răng sứ" or "Răng Implant". The
 * server makes them for the branch the first time the list is read, which is
 * this very call when nobody has opened the tab yet.
 */
async function groupOf(branchId: string, kind: RestorationMaterialKind): Promise<string> {
  const groups = await api
    .get<PagedResult<TaxonomyResponse>>("/v1/app/taxonomies", {
      params: { clinicBranchId: branchId, group: GROUP, maxResultCount: 20 },
    })
    .then((r) => r.data);
  const wanted = kind === RESTORATION_MATERIAL_KIND.Implant ? "implant" : "crown";
  const group = groups.items.find((item) => item.subGroup === wanted);
  if (!group) throw new Error(`No ${wanted} group for branch ${branchId}`);
  return group.id;
}

/** Adds a type, or corrects one; answers with the saved row. */
export function useSaveRestorationMaterial() {
  const branchId = useCurrentBranchId();

  return useMutation({
    mutationFn: async ({
      existing,
      input,
    }: {
      existing: RestorationMaterial | null;
      input: RestorationMaterialInput;
    }): Promise<RestorationMaterial> => {
      const restoration = { kind: input.kind, brand: input.brand, origin: input.origin, warranty: input.warranty };
      const saved = existing
        ? await api
            .put<EntryResponse>(`/v1/app/catalog-entries/${existing.id}`, {
              taxonomyId: existing.taxonomyId,
              name: input.name,
              code: existing.code ?? undefined,
              isActive: existing.isActive,
              isDeleted: false,
              sortOrder: existing.sortOrder,
              restoration,
            })
            .then((r) => r.data)
        : await api
            .post<EntryResponse>("/v1/app/catalog-entries", {
              clinicBranchId: branchId,
              taxonomyId: await groupOf(branchId, input.kind),
              name: input.name,
              sortOrder: 0,
              restoration,
            })
            .then((r) => r.data);

      return {
        id: saved.id,
        name: saved.name,
        kind: saved.restoration?.kind ?? input.kind,
        brand: saved.restoration?.brand ?? null,
        origin: saved.restoration?.origin ?? null,
        warranty: saved.restoration?.warranty ?? null,
        taxonomyId: saved.taxonomyId,
        sortOrder: saved.sortOrder,
        isActive: saved.isActive,
        code: saved.code,
      };
    },
    meta: { invalidates: ["catalog"] },
  });
}
