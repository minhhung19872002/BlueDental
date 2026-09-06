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
