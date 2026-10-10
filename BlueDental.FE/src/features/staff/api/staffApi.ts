import { api } from "@/lib/axios";
import type { StaffRole } from "@/hooks/useStaffOptions";
import type { PagedResult } from "@/types";

/** Mirrors BlueDental.Staff.StaffContractType — "Loại hợp đồng". */
export const CONTRACT_TYPES = [1, 2, 3, 4] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export interface StaffDto {
  id: string;
  userName: string;
  name: string | null;
  surname: string | null;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  creationTime: string;
  roleNames: string[];
  branchIds: string[];

  address: string | null;
  provinceId: string | null;
  wardId: string | null;

  isDentist: boolean;
  isAssistant: boolean;
  isHygienist: boolean;
  /** "Cho phép đăng nhập ngoài công ty" — skips the branch IP check. */
  allowLoginOutsideOffice: boolean;
  /** "Cho phép dùng ngoài giờ" — skips the branch's allowed hours. */
  allowLoginOutsideHours: boolean;
  /** "Quy định giảm giá": giảm tối đa % / VNĐ; null = no limit. */
  maxDiscountPercent: number | null;
  maxDiscountAmount: number | null;
  /** Hồ sơ công việc (Cụm 11 mục 1). Dates are "YYYY-MM-DD". */
  position: string | null;
  practiceCertificateNumber: string | null;
  practiceCertificateIssuedOn: string | null;
  practiceCertificateIssuedPlace: string | null;
  contractType: ContractType | null;
  contractStartDate: string | null;
  contractEndDate: string | null;

  morningStartTime: string | null;
  morningEndTime: string | null;
  afternoonStartTime: string | null;
  afternoonEndTime: string | null;

  avatarUrl: string | null;
}

export interface GetStaffListInput {
  skipCount?: number;
  maxResultCount?: number;
  filter?: string;
  isActive?: boolean;
  sorting?: string;
  branchId?: string;
  /** "YYYY-MM-DD" — leaves out staff registered OFF that day (Chấm công). */
  availableOn?: string;
  /** Only staff ticked for this role on the staff form — see `STAFF_ROLE`. */
  role?: StaffRole;
  /** Lịch làm việc / Chấm công: only staff the org chart lets the caller see (F-67). */
  scheduleScope?: boolean;
}

export interface CreateStaffInput {
  userName: string;
  password: string;
  name?: string;
  surname?: string;
  email: string;
  phoneNumber?: string;
  isActive: boolean;
  roleNames: string[];
  branchIds: string[];

  address?: string;
  provinceId?: string;
  wardId?: string;

  isDentist?: boolean;
  isAssistant?: boolean;
  isHygienist?: boolean;
  allowLoginOutsideOffice?: boolean;
  allowLoginOutsideHours?: boolean;
  maxDiscountPercent?: number | null;
  maxDiscountAmount?: number | null;
  position?: string | null;
  practiceCertificateNumber?: string | null;
  practiceCertificateIssuedOn?: string | null;
  practiceCertificateIssuedPlace?: string | null;
  contractType?: ContractType | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;

  morningStartTime?: string;
  morningEndTime?: string;
  afternoonStartTime?: string;
  afternoonEndTime?: string;
}

export interface UpdateStaffInput {
  password?: string;
  name?: string;
  surname?: string;
  email: string;
  phoneNumber?: string;
  isActive: boolean;
  roleNames: string[];
  branchIds: string[];

  address?: string;
  provinceId?: string;
  wardId?: string;

  isDentist?: boolean;
  isAssistant?: boolean;
  isHygienist?: boolean;
  allowLoginOutsideOffice?: boolean;
  allowLoginOutsideHours?: boolean;
  maxDiscountPercent?: number | null;
  maxDiscountAmount?: number | null;
  position?: string | null;
  practiceCertificateNumber?: string | null;
  practiceCertificateIssuedOn?: string | null;
  practiceCertificateIssuedPlace?: string | null;
  contractType?: ContractType | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;

  morningStartTime?: string;
  morningEndTime?: string;
  afternoonStartTime?: string;
  afternoonEndTime?: string;
}

const BASE = "/v1/app/staff";

export const staffApi = {
  list: (params: GetStaffListInput): Promise<PagedResult<StaffDto>> =>
    api.get<PagedResult<StaffDto>>(BASE, { params }).then((r) => r.data),

  get: (id: string): Promise<StaffDto> =>
    api.get<StaffDto>(`${BASE}/${id}`).then((r) => r.data),

  roleNames: (): Promise<string[]> =>
    api.get<string[]>(`${BASE}/roles`).then((r) => r.data),

  /** "Chức vụ" already in use, for the field's suggestions. */
  positions: (): Promise<string[]> =>
    api.get<string[]>(`${BASE}/positions`).then((r) => r.data),

  create: (input: CreateStaffInput): Promise<StaffDto> =>
    api.post<StaffDto>(BASE, input).then((r) => r.data),

  update: (id: string, input: UpdateStaffInput): Promise<StaffDto> =>
    api.put<StaffDto>(`${BASE}/${id}`, input).then((r) => r.data),

  remove: (id: string): Promise<void> => api.delete(`${BASE}/${id}`).then(() => undefined),

  uploadAvatar: (id: string, file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ url: string }>(`${BASE}/${id}/avatar`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  deleteAvatar: (id: string): Promise<void> =>
    api.delete(`${BASE}/${id}/avatar`).then(() => undefined),
};
