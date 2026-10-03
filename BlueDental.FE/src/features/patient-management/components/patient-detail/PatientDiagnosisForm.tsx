import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Form, Input, Select, Tooltip } from "antd";
import { CloseOutlined, SearchOutlined } from "@ant-design/icons";
import { FloatingField } from "@/components/FloatingField";
import {
  DentitionRadio,
  ToothChart,
  ToothPickerTabs,
  toothSelectionsToValue,
  toothValueToSelections,
} from "@/components/ToothChart";
import type { PatientDiagnosisDto } from "@/features/treatment-management/api/consultingApi";
import { t } from "@/lib/i18n";
import { useDiagnosisDraft } from "../../hooks/useDiagnosisDraft";
import type { DiagnosisIntent, DiagnosisSubmission } from "../../hooks/useDiagnosisEditor";
import { DiagnosisDoctorFields, type DiagnosisOption } from "./DiagnosisDoctorFields";
import { DiagnosisFormCommands } from "./DiagnosisFormCommands";
import { DiagnosisSelectedTeeth } from "./DiagnosisSelectedTeeth";

interface FormValues {
  staffId?: string;
  secondStaffId?: string;
  diagnosisId?: string;
  note?: string;
}

interface Props {
  dentists: DiagnosisOption[];
  /** Today's appointment doctor: a blank form starts with it as doctor 1. */
  defaultDoctor?: DiagnosisOption | null;
  diagnoses: DiagnosisOption[];
  submitting: boolean;
  /** A slip opened from the table: the fields come prefilled and the foot reads "Cập nhật". */
  editing?: PatientDiagnosisDto | null;
  /** Changes after "Thêm chẩn đoán" saved: the blank form starts over. */
  blankCount?: number;
  onSubmit: (submission: DiagnosisSubmission) => void;
  onClose: () => void;
}

interface NamedDoctor {
  value?: string | null;
  label?: string | null;
}

/**
 * `dentists` is only who is not OFF today; a saved slip's own doctors, and the
 * appointment's doctor a blank form starts with, stay listed so the field never
 * shows a bare id.
 */
function withNamedDoctors(dentists: DiagnosisOption[], named: NamedDoctor[]) {
  const extra = named.flatMap(({ value, label }) =>
    value && !dentists.some((d) => d.value === value) ? [{ value, label: label ?? "" }] : [],
  );
  return extra.length ? [...dentists, ...extra] : dentists;
}

/**
 * The expanded "Tạo chẩn đoán" editor, laid out as the reference lays it out:
 * doctors, the tab strip and the chart on the left; diagnosis, note, the
 * chosen teeth and the commands in a 260px column on the right.
 *
 * Opened on a saved slip, the diagnosis itself is locked: the server's update
 * cannot change it yet (docs/clone/unknowns.md).
 */
export function PatientDiagnosisForm({
  dentists,
  defaultDoctor,
  diagnoses,
  submitting,
  editing,
  blankCount = 0,
  onSubmit,
  onClose,
}: Props) {
  const [form] = Form.useForm<FormValues>();
  const [secondEnabled, setSecondEnabled] = useState(false);
  const draft = useDiagnosisDraft();
  const shownBlank = useRef(blankCount);

  const { load, reset } = draft;
  useEffect(() => {
    const nextSlip = shownBlank.current !== blankCount;
    shownBlank.current = blankCount;
    if (!editing) {
      reset();
      // After "Thêm chẩn đoán" the next slip is by the same doctors: only the
      // diagnosis, the note and the teeth start over (BA request, 2026-10-03).
      if (nextSlip) {
        form.resetFields(["diagnosisId", "note"]);
        return;
      }
      form.resetFields();
      setSecondEnabled(false);
      return;
    }
    setSecondEnabled(Boolean(editing.secondStaffId));
    form.setFieldsValue({
      staffId: editing.staffId,
      secondStaffId: editing.secondStaffId ?? undefined,
      diagnosisId: editing.diagnosisId,
      note: editing.note ?? undefined,
    });
    load(toothSelectionsToValue(editing.teeth));
  }, [editing, blankCount, form, load, reset]);

  // A blank form starts with the appointment's doctor, still free to change;
  // the appointment may load after the form opened, so it fills in late too.
  const defaultDoctorId = defaultDoctor?.value;
  useEffect(() => {
    if (editing || !defaultDoctorId || form.getFieldValue("staffId")) return;
    form.setFieldValue("staffId", defaultDoctorId);
  }, [editing, defaultDoctorId, form]);

  const doctorOptions = useMemo(
    () =>
      withNamedDoctors(
        dentists,
        editing
          ? [
              { value: editing.staffId, label: editing.staffName },
              { value: editing.secondStaffId, label: editing.secondStaffName },
            ]
          : [defaultDoctor ?? {}],
      ),
    [dentists, editing, defaultDoctor],
  );

  const staffId = Form.useWatch("staffId", form);
  const diagnosisId = Form.useWatch("diagnosisId", form);
  const ready = Boolean(staffId && diagnosisId) && !draft.isEmpty && !submitting;

  const handleToggleSecond = () => {
    if (secondEnabled) form.setFieldValue("secondStaffId", undefined);
    setSecondEnabled((value) => !value);
  };

  const submit = (intent: DiagnosisIntent) => {
    const values = form.getFieldsValue();
    if (!values.staffId || !values.diagnosisId) return;
    onSubmit({
      staffId: values.staffId,
      secondStaffId: secondEnabled ? values.secondStaffId : undefined,
      diagnosisId: values.diagnosisId,
      note: values.note?.trim() || undefined,
      teeth: toothValueToSelections(draft.value),
      intent,
    });
  };

  return (
    <Form form={form} className="pd-diagnosis-form" data-testid="diagnosis-form">
      <Tooltip title={t("Common:Close")}>
        <Button
          type="primary"
          shape="circle"
          danger
          className="pd-diagnosis-close"
          aria-label={t("Common:Close")}
          icon={<CloseOutlined />}
          onClick={onClose}
        />
      </Tooltip>

      <div className="pd-diagnosis-main">
        <DiagnosisDoctorFields
          dentists={doctorOptions}
          secondEnabled={secondEnabled}
          onToggleSecond={handleToggleSecond}
        />
        <div className="pd-diagnosis-head">
          <ToothPickerTabs value={draft.tab} onChange={draft.setTab} />
          {draft.picking && (
            <DentitionRadio value={draft.dentition} onChange={draft.setDentition} />
          )}
        </div>
        {draft.picking && (
          <div className="pd-diagnosis-chart">
            <ToothChart
              value={draft.teeth}
              dentition={draft.dentition}
              onToggleTooth={draft.pickTooth}
              onToggleSurface={draft.pickSurface}
            />
          </div>
        )}
      </div>

      <div className="pd-diagnosis-side">
        <FloatingField name="diagnosisId" label={t("Patient:Tab:Diagnosis")} required>
          <Select
            showSearch
            optionFilterProp="label"
            prefix={<SearchOutlined />}
            options={diagnoses}
            notFoundContent={t("Common:NoResults")}
          />
        </FloatingField>
        <FloatingField name="note" label={t("Common:Note")}>
          <Input.TextArea className="pd-diagnosis-note" />
        </FloatingField>
        <DiagnosisSelectedTeeth
          value={draft.value}
          onRemoveTooth={draft.removeTooth}
          onClearJaw={draft.clearJaw}
        />
        <DiagnosisFormCommands
          editing={Boolean(editing)}
          ready={ready}
          submitting={submitting}
          onSubmit={submit}
        />
      </div>
    </Form>
  );
}
