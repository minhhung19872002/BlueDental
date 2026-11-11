import { formatDateTime } from "@/utils/format";
import type { XrayInboxItemDto, XrayPatientSuggestionDto, XraySuggestionReason } from "./xrayInboxApi";

export interface XrayInboxItemViewModel {
  id: string;
  fileName: string;
  url: string;
  /** `dd/MM/yyyy HH:mm`, when the server took it in. */
  receivedLabel: string;
  deviceName: string;
  /** What the file name said, for staff to match by eye; null when it said nothing. */
  hintCode: string | null;
  hintName: string | null;
  hintBirthYear: number | null;
}

export interface XraySuggestionViewModel {
  patientId: string;
  /** `[CODE] - NAME (YYYY)`, the way the patient pickers write a record. */
  label: string;
  reason: XraySuggestionReason;
}

export function adaptXrayInboxItem(dto: XrayInboxItemDto): XrayInboxItemViewModel {
  return {
    id: dto.id,
    fileName: dto.fileName,
    url: dto.url,
    receivedLabel: formatDateTime(dto.receivedAt),
    deviceName: dto.xrayDeviceName ?? "",
    hintCode: dto.hintCode,
    hintName: dto.hintName,
    hintBirthYear: dto.hintBirthYear,
  };
}

export function adaptXraySuggestion(dto: XrayPatientSuggestionDto): XraySuggestionViewModel {
  const year = dto.birthYear ? ` (${dto.birthYear})` : "";
  return {
    patientId: dto.patientId,
    label: `[${dto.patientCode}] - ${dto.fullName.toUpperCase()}${year}`,
    reason: dto.reason,
  };
}
