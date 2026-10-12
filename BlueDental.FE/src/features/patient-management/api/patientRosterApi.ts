import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { downloadFile, downloadPostedFile } from "@/lib/download";

/**
 * The patient roster file (F-69): every patient of every branch on one sheet,
 * exported, edited in Excel and imported back. Only rows marked in the Action
 * column are read — E adds or edits, D deletes. Admin only.
 */

export const ROSTER_ROW_ACTION = {
  Create: 0,
  Update: 1,
  Error: 2,
  Delete: 3,
} as const;

export type RosterRowAction = (typeof ROSTER_ROW_ACTION)[keyof typeof ROSTER_ROW_ACTION];

export interface PatientRosterRowDto {
  /** Excel row number, header included. */
  row: number;
  /** The file's code, or the one a new patient will get. */
  patientCode: string | null;
  fullName: string | null;
  action: RosterRowAction;
  errors: string[];
}

export interface PatientRosterResultDto {
  dryRun: boolean;
  committed: boolean;
  totalRows: number;
  errorCount: number;
  created: number;
  updated: number;
  deleted: number;
  /** Rows with a blank Action: left alone. */
  unmarked: number;
  fileErrors: string[];
  rows: PatientRosterRowDto[];
}

export interface ImportPatientRosterInput {
  file: File;
  /** True reads and validates only — the preview step. */
  dryRun: boolean;
}

const BASE = "/v1/app/patient-roster";

function importForm(input: ImportPatientRosterInput): FormData {
  const form = new FormData();
  form.append("file", input.file);
  form.append("dryRun", String(input.dryRun));
  return form;
}

const patientRosterApi = {
  export: (): Promise<void> => downloadFile(`${BASE}/export`, "danh-sach-benh-nhan.xlsx"),

  run: (input: ImportPatientRosterInput): Promise<PatientRosterResultDto> =>
    api.post<PatientRosterResultDto>(`${BASE}/import`, importForm(input)).then((r) => r.data),

  downloadErrors: (input: ImportPatientRosterInput): Promise<void> =>
    downloadPostedFile(`${BASE}/import-errors`, importForm(input), "loi-danh-sach-benh-nhan.xlsx"),
};

export function useExportPatientRoster() {
  return useMutation({ mutationFn: () => patientRosterApi.export() });
}

export function useDownloadRosterErrors() {
  return useMutation({
    mutationFn: (input: ImportPatientRosterInput) => patientRosterApi.downloadErrors(input),
  });
}

/** One mutation serves the preview (dryRun) and the real import; the commit reloads every patient view. */
export function useImportPatientRoster() {
  return useMutation({
    mutationKey: ["patients", "roster-import"],
    mutationFn: (input: ImportPatientRosterInput) => patientRosterApi.run(input),
    meta: { invalidates: ["patient"] },
  });
}
