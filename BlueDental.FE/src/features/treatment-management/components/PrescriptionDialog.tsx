import { useNavigate } from "react-router-dom";
import { Form, Input } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { t } from "@/lib/i18n";
import type { PrescriptionDto } from "../api/prescriptionApi";
import { usePrescriptionAllergyConflicts } from "../hooks/usePrescriptionAllergyConflicts";
import { usePrescriptionDialogForm, type RxFormValues } from "../hooks/usePrescriptionDialogForm";
import { usePrescriptionSave } from "../hooks/usePrescriptionSave";
import type { PrescriptionPatientSummary } from "../types/prescription";
import { printedDiagnosisText } from "../utils/rxDiagnosis";
import { PrescriptionAllergyAlert } from "./PrescriptionAllergyAlert";
import { RxAdviceRow } from "./prescription-dialog/RxAdviceRow";
import { RxDiagnosisSection } from "./prescription-dialog/RxDiagnosisSection";
import { RxHeaderFields } from "./prescription-dialog/RxHeaderFields";
import { RxMedicineSection } from "./prescription-dialog/RxMedicineSection";
import "./prescription.css";

interface Props {
  open: boolean;
  patient: PrescriptionPatientSummary;
  /** The slip being edited; null opens the dialog empty. */
  prescription: PrescriptionDto | null;
  onClose: () => void;
}

/**
 * "Thêm đơn thuốc" / "Cập nhật đơn thuốc" (F-58): the patient beside the
 * doctor, Điều trị and Tái khám; then the diagnoses picked from the patient's
 * phiếu điều trị and their note; the advice; then the medicine lines dosed
 * Sáng / Trưa / Chiều / Tối. A medicine the patient declared an allergy to
 * (Tiểu sử bệnh) raises a warning and asks once more on Lưu (R-744).
 */
export function PrescriptionDialog({ open, patient, prescription, onClose }: Props) {
  const navigate = useNavigate();
  const state = usePrescriptionDialogForm(open, patient.id, prescription);
  const { form, lines, medicines, diagnoses, legacyDiagnosisText } = state;

  const staffId = Form.useWatch("staffId", form);
  const saveAsTemplate = Form.useWatch("saveAsTemplate", form) ?? false;
  const templateName = Form.useWatch("templateName", form) ?? "";
  const allergyConflicts = usePrescriptionAllergyConflicts(patient.diseaseHistoryEntryIds, lines, medicines);

  const filledLines = lines.filter((line) => line.medicineEntryId);
  const save = usePrescriptionSave({
    patientId: patient.id,
    prescription,
    lines: filledLines,
    diagnoses: diagnoses.rows,
    legacyDiagnosisText,
    hasAllergyConflict: allergyConflicts.length > 0,
    onSaved: onClose,
  });

  const canSave =
    Boolean(staffId) &&
    filledLines.length > 0 &&
    (!saveAsTemplate || templateName.trim().length > 0);
  const printedText = diagnoses.rows.length > 0 ? printedDiagnosisText(diagnoses.rows) : legacyDiagnosisText;

  return (
    <AppDialog
      open={open}
      title={prescription ? t("Treatment:Prescription:UpdatePrescription") : t("Treatment:Prescription:AddPrescription")}
      width={1120}
      centered
      className="rx-dialog"
      canSave={canSave}
      saving={save.saving}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form<RxFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={state.initialValues}
        onFinish={save.handleFinish}
      >
        <RxHeaderFields patient={patient} />
        <RxDiagnosisSection
          rows={diagnoses.rows}
          printedText={printedText}
          sources={state.sources}
          sourcesLoading={state.sourcesLoading}
          pickedKeys={diagnoses.pickedKeys}
          onToggle={diagnoses.toggle}
          onRemove={diagnoses.remove}
        />
        <Form.Item name="diagnosisNote" label={t("Treatment:Rx:DiagnosisNote")} className="rx-dx-note">
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={1000}
            placeholder={t("Treatment:Rx:DiagnosisNotePlaceholder")}
            aria-label={t("Treatment:Rx:DiagnosisNote")}
          />
        </Form.Item>
        <PrescriptionAllergyAlert conflicts={allergyConflicts} />
        <RxAdviceRow saveAsTemplate={saveAsTemplate} />
        <RxMedicineSection
          lines={lines}
          medicines={medicines}
          templates={state.templates}
          onChange={state.setLines}
          onPickTemplate={state.pickTemplate}
          onAddMedicineType={() => navigate("/taxonomy/medicine")}
        />
      </Form>
      <ConfirmDialog
        open={save.confirmingAllergy}
        title={t("Treatment:Rx:AllergyTitle")}
        message={t("Treatment:Rx:AllergyConfirm")}
        confirmLabel={t("Treatment:Rx:AllergyConfirmSave")}
        pending={save.saving}
        onConfirm={save.handleConfirmAllergy}
        onClose={save.handleCancelAllergy}
      />
    </AppDialog>
  );
}
