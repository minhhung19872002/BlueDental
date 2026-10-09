/**
 * What the Đơn thuốc tab needs to know about its patient — the header block of
 * the dialog and the ids the slip is filed under. The patient feature owns the
 * full record and hands this slice across, so neither feature imports the other.
 */
export interface PrescriptionPatientSummary {
  id: string;
  code: string;
  fullName: string;
  /** Already translated: "Nam", "Nữ"… */
  genderLabel: string;
  dateOfBirth: string | null;
  phoneNumber: string | null;
  /** Lịch sử bệnh catalog entries ticked on the record. */
  diseaseHistoryEntryIds: string[];
}

/**
 * One diagnosis of one phiếu điều trị — a row of the "Phiếu điều trị" picker
 * and of the picked-diagnosis table (F-58). `key` is `planId:diagnosisId`.
 */
export interface RxDiagnosisRow {
  key: string;
  treatmentPlanId: string;
  diagnosisId: string;
  planCode: string;
  /** When the plan was opened; null for a pick read back from a saved slip. */
  planDate: string | null;
  diagnosisName: string;
  toothCodes: number[];
  /** The source diagnosis notes, distinct; empty for a saved pick. */
  notes: string[];
}
