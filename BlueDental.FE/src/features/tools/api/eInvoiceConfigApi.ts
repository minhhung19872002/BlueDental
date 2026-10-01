import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

// Công cụ › Hóa đơn › Cấu hình — one EasyInvoice account per clinic branch.
// The password is write-only: the server only says whether one is stored.

export interface EInvoiceConfigDto {
  id: string;
  clinicBranchId: string;
  name: string;
  provider: string;
  appId: string | null;
  username: string;
  hasPassword: boolean;
  taxCode: string;
  taxByService: boolean;
  taxByPeriod: boolean;
  isActive: boolean;
  /** The Mẫu số / ký hiệu the last invoice went out under — prefills the Hóa đơn dialog. */
  lastPattern: string | null;
  lastSerial: string | null;
  creationTime: string;
}

/**
 * The fields of the original Cấu hình form. The form has no rules, so the
 * server refuses a blank name, MST, user or (on create) password.
 */
export interface CreateUpdateEInvoiceConfigDto {
  /** Fixed after create — the server ignores a change on update. */
  clinicBranchId: string;
  name: string;
  appId: string | null;
  username: string;
  /** Required on create; blank on update keeps the stored one. */
  password?: string;
  taxCode: string;
  taxByService: boolean;
  taxByPeriod: boolean;
  isActive: boolean;
}

interface ListResult<T> {
  items: T[];
}

const BASE = "/v1/app/e-invoice-configs";
const CONFIG_KEY = ["e-invoice-configs"] as const;
// The invoice dialog's draft names the account it will use.
const DRAFT_KEY = ["e-invoices"] as const;

export function useEInvoiceConfigs(clinicBranchId?: string) {
  return useQuery({
    queryKey: [...CONFIG_KEY, clinicBranchId ?? "all"],
    queryFn: () =>
      api
        .get<ListResult<EInvoiceConfigDto>>(BASE, { params: { clinicBranchId } })
        .then((r) => r.data.items),
  });
}

function useInvalidateConfigs() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: CONFIG_KEY });
    void qc.invalidateQueries({ queryKey: DRAFT_KEY });
  };
}

export function useCreateEInvoiceConfig() {
  const invalidate = useInvalidateConfigs();
  return useMutation({
    mutationFn: (data: CreateUpdateEInvoiceConfigDto) =>
      api.post<EInvoiceConfigDto>(BASE, data).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useUpdateEInvoiceConfig() {
  const invalidate = useInvalidateConfigs();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateUpdateEInvoiceConfigDto }) =>
      api.put<EInvoiceConfigDto>(`${BASE}/${id}`, data).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useDeleteEInvoiceConfig() {
  const invalidate = useInvalidateConfigs();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`),
    onSuccess: invalidate,
  });
}
