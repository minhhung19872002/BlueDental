import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/**
 * The lists behind the Labo "Đặt mới" form.
 *
 * They live here rather than in `features/labo/api` because the form is opened
 * from a treatment row in `features/patient-management`, and feature folders do
 * not import one another — the same reason `usePaymentAccountOptions` sits
 * beside this file. The Labo screens keep their own richer hooks.
 */

/** Taxonomy groups the Labo form picks from. */
export const LABO_TAXONOMY = {
  supplier: "labo_supplier",
  bite: "labo_bite",
  finishLine: "labo_finish_line",
  rhythm: "labo_rhythm",
  /** The groups of Dịch vụ - vật liệu; the reference calls it "Lựa chọn dịch vụ". */
  material: "labo_material",
} as const;

export interface PickerOption {
  value: string;
  label: string;
}

interface NamedRow {
  id: string;
  name: string;
}

function toOptions(rows: NamedRow[]): PickerOption[] {
  return rows.map((row) => ({ value: row.id, label: row.name }));
}

/** Every row of one labo taxonomy group, unpaged. */
export function useLaboTaxonomyOptions(group: string, clinicBranchId: string, enabled = true) {
  return useQuery<PickerOption[]>({
    queryKey: ["labo-taxonomy-options", group, clinicBranchId],
    queryFn: () =>
      api
        .get<PagedResult<NamedRow>>("/v1/app/taxonomies", {
          params: { ClinicBranchId: clinicBranchId, Group: group, MaxResultCount: 200 },
        })
        .then((r) => toOptions(r.data.items)),
    enabled: enabled && Boolean(group) && Boolean(clinicBranchId),
    staleTime: 5 * 60_000,
  });
}

/** Nhà cung cấp — its own table, not a taxonomy. */
export function useLaboSupplierOptions(clinicBranchId: string, enabled = true) {
  return useQuery<PickerOption[]>({
    queryKey: ["labo-supplier-options", clinicBranchId],
    queryFn: () =>
      api
        .get<PagedResult<NamedRow>>("/v1/app/labo-suppliers", {
          params: { ClinicBranchId: clinicBranchId, MaxResultCount: 200 },
        })
        .then((r) => toOptions(r.data.items)),
    enabled: enabled && Boolean(clinicBranchId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Vật liệu inside one Lựa chọn dịch vụ group. Disabled until a group is
 * chosen — the reference prints "Chọn dịch vụ trước" in the empty box.
 */
export function useLaboMaterialOptions(clinicBranchId: string, taxonomyId: string | undefined) {
  return useQuery<PickerOption[]>({
    queryKey: ["labo-material-options", clinicBranchId, taxonomyId ?? null],
    queryFn: () =>
      api
        .get<PagedResult<NamedRow>>("/v1/app/labo-materials", {
          params: { ClinicBranchId: clinicBranchId, TaxonomyId: taxonomyId, MaxResultCount: 200 },
        })
        .then((r) => toOptions(r.data.items)),
    enabled: Boolean(clinicBranchId) && Boolean(taxonomyId),
    staleTime: 5 * 60_000,
  });
}

/** Số phiếu Labo the next order would take. */
export function useNextLaboCode(enabled: boolean) {
  return useQuery<string>({
    queryKey: ["labo-next-code"],
    queryFn: () => api.get<string>("/v1/app/labo-orders/next-code").then((r) => r.data),
    enabled,
    // A code is claimed by whoever saves first, so never serve a cached one.
    staleTime: 0,
    gcTime: 0,
  });
}

/** What "Đặt mới" posts. Mirrors BlueDental.Labo.CreateLaboOrderDto. */
export interface CreateLaboOrderInput {
  patientId: string;
  branchId: string;
  dentistId?: string;
  labProviderName: string;
  orderCode?: string;
  supplierId?: string;
  materialId?: string;
  biteId?: string;
  finishLineId?: string;
  rhythmId?: string;
  toothNumbers?: string;
  toothShade?: string;
  quantity: number;
  notes?: string;
  sentAt?: string;
  dueDate?: string;
  estimatedCost: number;
  treatmentServiceId?: string;
  treatmentStageId?: string;
  /** 1 Đặt mới (default) · 2 Làm tiếp công đoạn · 3 Bảo hành. */
  kind?: number;
  /** Required for kind 2 and 3: the order being continued / guaranteed. */
  parentOrderId?: string;
  /** Tải ảnh: filed into Hình ảnh under the order's plan and công đoạn, in the same request. */
  pictures?: File[];
}

/**
 * The order goes up as multipart so its pictures ride along: one request,
 * and the server writes the order and the pictures in one unit of work.
 * Fields that are unset stay out of the form so the server keeps its defaults.
 */
function toOrderForm({ pictures, ...fields }: CreateLaboOrderInput): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }
  for (const file of pictures ?? []) form.append("pictures", file);
  return form;
}

export function useCreateLaboOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLaboOrderInput) =>
      api.post("/v1/app/labo-orders", toOrderForm(input)).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["labo-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["labo-next-code"] });
    },
  });
}
