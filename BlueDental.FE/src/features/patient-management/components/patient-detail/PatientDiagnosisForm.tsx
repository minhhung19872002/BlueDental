import { useState } from "react";
import { Button, Form, Input, Select, Tooltip } from "antd";
import { CloseOutlined, SearchOutlined } from "@ant-design/icons";
import { FloatingField } from "@/components/FloatingField";
import {
  DentitionRadio,
  ToothChart,
  ToothPickerTabs,
  toothValueToSelections,
  type ToothSelection,
} from "@/components/ToothChart";
import { t } from "@/lib/i18n";
import { useDiagnosisDraft } from "../../hooks/useDiagnosisDraft";
import { DiagnosisDoctorFields, type DiagnosisOption } from "./DiagnosisDoctorFields";
import { DiagnosisSelectedTeeth } from "./DiagnosisSelectedTeeth";

/** "Lưu Chẩn Đoán" saves; "Tạo dịch vụ" saves and goes on to the advise. */
export type DiagnosisIntent = "save" | "service";

export interface DiagnosisSubmission {
  staffId: string;
  secondStaffId?: string;
  diagnosisId: string;
  note?: string;
  teeth: ToothSelection[];
  intent: DiagnosisIntent;
}

interface FormValues {
  staffId?: string;
  secondStaffId?: string;
  diagnosisId?: string;
  note?: string;
}

interface Props {
  dentists: DiagnosisOption[];
  diagnoses: DiagnosisOption[];
  submitting: boolean;
  onSubmit: (submission: DiagnosisSubmission) => void;
  onClose: () => void;
}

/**
 * The expanded "Tạo chẩn đoán" editor, laid out as the reference lays it out:
 * doctors, the tab strip and the chart on the left; diagnosis, note, the
 * chosen teeth and the commands in a 260px column on the right.
 *
 * "Thêm chẩn đoán" (queueing several diagnoses on one slip) is not wired yet
 * — the reference's behaviour could not be observed — so it stays disabled.
 */
export function PatientDiagnosisForm({
  dentists,
  diagnoses,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [form] = Form.useForm<FormValues>();
  const [secondEnabled, setSecondEnabled] = useState(false);
  const draft = useDiagnosisDraft();

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
      <Tooltip title={t("Đóng")}>
        <Button
          type="primary"
          shape="circle"
          danger
          className="pd-diagnosis-close"
          aria-label={t("Đóng")}
          icon={<CloseOutlined />}
          onClick={onClose}
        />
      </Tooltip>

      <div className="pd-diagnosis-main">
        <DiagnosisDoctorFields
          dentists={dentists}
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
        <FloatingField name="diagnosisId" label={t("Chẩn đoán")} required>
          <Select
            showSearch
            optionFilterProp="label"
            prefix={<SearchOutlined />}
            options={diagnoses}
            notFoundContent={t("Không tìm thấy kết quả")}
          />
        </FloatingField>
        <FloatingField name="note" label={t("Ghi chú")}>
          <Input.TextArea className="pd-diagnosis-note" />
        </FloatingField>
        <DiagnosisSelectedTeeth
          value={draft.value}
          onRemoveTooth={draft.removeTooth}
          onClearJaw={draft.clearJaw}
        />
        <Button type="primary" block disabled>
          {t("Thêm chẩn đoán")}
        </Button>
        <div className="pd-diagnosis-commands">
          <Button disabled={!ready} onClick={() => submit("service")}>
            {t("Tạo dịch vụ")}
          </Button>
          <Button
            className="pd-diagnosis-save"
            disabled={!ready}
            loading={submitting}
            onClick={() => submit("save")}
          >
            {t("Lưu Chẩn Đoán")}
          </Button>
        </div>
      </div>
    </Form>
  );
}
