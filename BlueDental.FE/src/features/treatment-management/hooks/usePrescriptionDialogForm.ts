import { useCallback, useEffect, useState } from "react";
import { Form } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { CATALOG_GROUP, useCatalogOptions, type CatalogOption } from "@/hooks/useCatalogOptions";
import {
  adaptPickedDiagnosis,
  PRESCRIPTION_TREATMENT_TYPE,
  usePrescriptionDiagnosisSources,
  type PrescriptionDto,
  type PrescriptionTreatmentType,
} from "../api/prescriptionApi";
import type { RxDiagnosisRow, RxMedicineLine } from "../types/prescription";
import { doseFromTemplate, EMPTY_RX_LINE } from "../utils/rxDose";
import { useRxDiagnosisSelection } from "./useRxDiagnosisSelection";

export interface RxFormValues {
  templateId?: string;
  staffId?: string;
  diagnosisNote: string;
  note: string;
  saveAsTemplate: boolean;
  templateName: string;
  treatmentType: PrescriptionTreatmentType;
  followUpDate: Dayjs | null;
}

const EMPTY_FORM: RxFormValues = {
  templateId: undefined,
  staffId: undefined,
  diagnosisNote: "",
  note: "",
  saveAsTemplate: false,
  templateName: "",
  treatmentType: PRESCRIPTION_TREATMENT_TYPE.Outpatient,
  followUpDate: null,
};

const NO_ROWS: RxDiagnosisRow[] = [];

function formOf(prescription: PrescriptionDto | null): RxFormValues {
  if (!prescription) return EMPTY_FORM;
  return {
    ...EMPTY_FORM,
    staffId: prescription.staffId,
    diagnosisNote: prescription.diagnosisNote ?? "",
    note: prescription.note ?? "",
    treatmentType: prescription.treatmentType,
    followUpDate: prescription.followUpDate ? dayjs(prescription.followUpDate) : null,
  };
}

function linesOf(prescription: PrescriptionDto | null): RxMedicineLine[] {
  if (!prescription || prescription.items.length === 0) return [{ ...EMPTY_RX_LINE }];
  return prescription.items.map((item) => ({
    id: item.id,
    medicineEntryId: item.medicationId,
    morning: item.morning,
    noon: item.noon,
    afternoon: item.afternoon,
    evening: item.evening,
    days: item.days,
    usage: item.usage,
    otherUsage: item.otherUsage,
  }));
}

/** A template's lines, ready to edit; the template's "n lần × mỗi lần" becomes sessions. */
function linesOfTemplate(template: CatalogOption): RxMedicineLine[] {
  if (template.prescriptionLines.length === 0) return [{ ...EMPTY_RX_LINE }];
  return template.prescriptionLines.map((line) => ({
    medicineEntryId: line.medicineEntryId,
    ...doseFromTemplate(line.timesPerDay, line.amountPerTime),
    days: line.days,
    usage: line.usage,
    otherUsage: line.otherUsage,
  }));
}

/**
 * The state of "Thêm / Cập nhật đơn thuốc": the form fields, the medicine
 * lines and the picked diagnoses, reset each time the dialog opens. Picking a
 * Đơn thuốc mẫu replaces the lines and fills the advice from it.
 */
export function usePrescriptionDialogForm(
  open: boolean,
  patientId: string,
  prescription: PrescriptionDto | null,
) {
  const templates = useCatalogOptions(CATALOG_GROUP.PrescriptionTemplate).data ?? [];
  const medicines = useCatalogOptions(CATALOG_GROUP.MedicationType).data ?? [];
  const sources = usePrescriptionDiagnosisSources(patientId, open);

  const [form] = Form.useForm<RxFormValues>();
  const [lines, setLines] = useState<RxMedicineLine[]>([{ ...EMPTY_RX_LINE }]);

  const readNote = useCallback((): string => form.getFieldValue("diagnosisNote") ?? "", [form]);
  const writeNote = useCallback((note: string) => form.setFieldValue("diagnosisNote", note), [form]);
  const diagnoses = useRxDiagnosisSelection({
    sources: sources.data ?? NO_ROWS,
    readNote,
    writeNote,
  });
  const { restore } = diagnoses;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(formOf(prescription));
    setLines(linesOf(prescription));
    restore(prescription?.diagnoses.map(adaptPickedDiagnosis) ?? []);
  }, [open, prescription, form, restore]);

  const pickTemplate = (templateId: string | undefined) => {
    const template = templates.find((option) => option.id === templateId);
    if (!template) return;
    setLines(linesOfTemplate(template));
    if (template.description) form.setFieldValue("note", template.description);
  };

  /** A slip written before F-58 keeps its free-text diagnosis until a pick replaces it. */
  const legacyDiagnosisText =
    prescription && prescription.diagnoses.length === 0 ? prescription.diagnosisText : null;

  return {
    form,
    initialValues: EMPTY_FORM,
    templates,
    medicines,
    sources: sources.data ?? NO_ROWS,
    sourcesLoading: sources.isLoading,
    lines,
    setLines,
    diagnoses,
    legacyDiagnosisText,
    pickTemplate,
  };
}
