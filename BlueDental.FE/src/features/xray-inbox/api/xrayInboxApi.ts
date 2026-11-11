import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/** Matches XrayInboxStatus (F-95). */
export type XrayInboxStatus = 1 | 2 | 3 | 4;

/** Matches XrayInboxItemDto: a picture an X-ray PC sent that no record took yet. */
export interface XrayInboxItemDto {
  id: string;
  clinicBranchId: string;
  xrayDeviceId: string;
  xrayDeviceName: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  hintCode: string | null;
  hintName: string | null;
  hintBirthYear: number | null;
  capturedAt: string | null;
  receivedAt: string;
  status: XrayInboxStatus;
  url: string;
}

/** Matches XraySuggestionReason: why a record is offered for a picture. */
export type XraySuggestionReason = 1 | 2 | 3;

/** Matches XrayPatientSuggestionDto. */
export interface XrayPatientSuggestionDto {
  patientId: string;
  patientCode: string;
  fullName: string;
  birthYear: number | null;
  reason: XraySuggestionReason;
}

export interface XrayInboxListQuery {
  clinicBranchId?: string;
  skipCount: number;
  maxResultCount: number;
}

const BASE = "/v1/app/xray-inbox";

/** Plain HTTP calls; only the query and mutation hooks beside this file use them. */
export const xrayInboxHttp = {
  list: (query: XrayInboxListQuery) =>
    api.get<PagedResult<XrayInboxItemDto>>(BASE, { params: query }).then((r) => r.data),
  count: (clinicBranchId?: string) =>
    api.get<number>(`${BASE}/count`, { params: { clinicBranchId } }).then((r) => r.data),
  suggestions: (id: string) =>
    api.get<XrayPatientSuggestionDto[]>(`${BASE}/${id}/suggestions`).then((r) => r.data),
  assign: (input: { id: string; patientId: string }) =>
    api.post<string>(`${BASE}/${input.id}/assign`, { patientId: input.patientId }).then((r) => r.data),
  discard: (id: string) => api.post(`${BASE}/${id}/discard`).then(() => undefined),
};
