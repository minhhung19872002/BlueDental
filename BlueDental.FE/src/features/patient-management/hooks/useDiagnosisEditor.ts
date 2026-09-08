import { useState } from "react";
import type { ToothSelection } from "@/components/ToothChart";
import type {
  CreatePatientDiagnosisDto,
  PatientDiagnosisDto,
  UpdatePatientDiagnosisDto,
} from "@/features/treatment-management/api/consultingApi";

/** "Lưu Chẩn Đoán" saves; "Tạo dịch vụ" saves and goes on to the advise; "Cập nhật" rewrites. */
export type DiagnosisIntent = "save" | "service" | "update";

export interface DiagnosisSubmission {
  staffId: string;
  secondStaffId?: string;
  diagnosisId: string;
  note?: string;
  teeth: ToothSelection[];
  intent: DiagnosisIntent;
}

interface DiagnosisWriter {
  create: (
    input: Omit<CreatePatientDiagnosisDto, "patientId" | "clinicBranchId">,
  ) => Promise<PatientDiagnosisDto | null>;
  update: (id: string, input: UpdatePatientDiagnosisDto) => Promise<PatientDiagnosisDto | null>;
}

/**
 * The "Tạo chẩn đoán" panel: the round + opens it blank, a row of the table
 * opens it on that slip. The row is kept as clicked, so a background refetch
 * of the table never resets what the doctor is typing.
 */
export function useDiagnosisEditor(
  writer: DiagnosisWriter,
  onService: (created: PatientDiagnosisDto) => void,
) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<PatientDiagnosisDto | null>(null);

  const close = () => {
    setExpanded(false);
    setEditing(null);
  };

  const toggle = () => {
    if (expanded) {
      close();
      return;
    }
    setEditing(null);
    setExpanded(true);
  };

  const edit = (row: PatientDiagnosisDto) => {
    setEditing(row);
    setExpanded(true);
  };

  const submit = async ({ intent, ...input }: DiagnosisSubmission) => {
    const saved =
      intent === "update"
        ? editing &&
          (await writer.update(editing.id, {
            staffId: input.staffId,
            secondStaffId: input.secondStaffId,
            note: input.note,
            teeth: input.teeth,
          }))
        : await writer.create(input);
    if (!saved) return;
    close();
    if (intent === "service") onService(saved);
  };

  return { expanded, editing, toggle, edit, close, submit };
}
