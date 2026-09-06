import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Checkbox, DatePicker, Form, Input, Select } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import {
  EMPTY_PRESCRIPTION_LINE,
  PrescriptionLineEditor,
  type PrescriptionLine,
} from "@/components/prescription-lines";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { CATALOG_GROUP, useCatalogOptions, type CatalogOption } from "@/hooks/useCatalogOptions";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import {
  PRESCRIPTION_TREATMENT_TYPE,
  treatmentTypeOptions,
  useCreatePrescription,
  useUpdatePrescription,
  type PrescriptionDto,
  type PrescriptionTreatmentType,
  type UpdatePrescriptionRequest,
} from "../api/prescriptionApi";
import type { PrescriptionPatientSummary } from "../types/prescription";
import { PrescriptionPatientBlock } from "./PrescriptionPatientBlock";

interface FormValues {
  templateId?: string;
  staffId?: string;
  diagnosisText: string;
  note: string;
  saveAsTemplate: boolean;
  templateName: string;
  treatmentType: PrescriptionTreatmentType;
  followUpDate: Dayjs | null;
}

interface Props {
  open: boolean;
  patient: PrescriptionPatientSummary;
  /** The slip being edited; null opens the dialog empty. */
  prescription: PrescriptionDto | null;
  onClose: () => void;
}

const EMPTY_FORM: FormValues = {
  templateId: undefined,
  staffId: undefined,
  diagnosisText: "",
  note: "",
  saveAsTemplate: false,
  templateName: "",
  treatmentType: PRESCRIPTION_TREATMENT_TYPE.Outpatient,
  followUpDate: null,
};

function linesOf(prescription: PrescriptionDto | null): PrescriptionLine[] {
  if (!prescription || prescription.items.length === 0) return [{ ...EMPTY_PRESCRIPTION_LINE }];
  return prescription.items.map((item) => ({
    id: item.id,
    medicineEntryId: item.medicationId,
    timesPerDay: item.timesPerDay,
    amountPerTime: item.amountPerTime,
    days: item.days,
    usage: item.usage,
    otherUsage: item.otherUsage,
  }));
}

/** A template's lines, ready to edit; the template's own ids stay behind. */
function linesOfTemplate(template: CatalogOption): PrescriptionLine[] {
  if (template.prescriptionLines.length === 0) return [{ ...EMPTY_PRESCRIPTION_LINE }];
  return template.prescriptionLines.map((line) => ({
    medicineEntryId: line.medicineEntryId,
    timesPerDay: line.timesPerDay,
    amountPerTime: line.amountPerTime,
    days: line.days,
    usage: line.usage,
    otherUsage: line.otherUsage,
  }));
}

/**
 * "Thêm đơn thuốc" / "Cập nhật đơn thuốc" — the patient at the top, the
 * doctor, diagnosis and advice, then the medicine lines. Picking a Đơn thuốc
 * mẫu replaces the lines with the template's and fills the advice from it;
 * ticking "Lưu đơn thuốc mẫu" asks for a name and files the lines back into
 * that catalog when the slip is saved.
 */
export function PrescriptionDialog({ open, patient, prescription, onClose }: Props) {
  const navigate = useNavigate();
  const branchId = useCurrentBranchId();
  const templates = useCatalogOptions(CATALOG_GROUP.PrescriptionTemplate).data ?? [];
  const medicines = useCatalogOptions(CATALOG_GROUP.MedicationType).data ?? [];
  const dentists = useDentistList().data ?? [];
  const create = useCreatePrescription();
  const update = useUpdatePrescription();

  const [form] = Form.useForm<FormValues>();
  const staffId = Form.useWatch("staffId", form);
  const saveAsTemplate = Form.useWatch("saveAsTemplate", form) ?? false;
  const templateName = Form.useWatch("templateName", form) ?? "";
  const [lines, setLines] = useState<PrescriptionLine[]>([{ ...EMPTY_PRESCRIPTION_LINE }]);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(
      prescription
        ? {
            ...EMPTY_FORM,
            staffId: prescription.staffId,
            diagnosisText: prescription.diagnosisText ?? "",
            note: prescription.note ?? "",
            treatmentType: prescription.treatmentType,
            followUpDate: prescription.followUpDate ? dayjs(prescription.followUpDate) : null,
          }
        : EMPTY_FORM,
    );
    setLines(linesOf(prescription));
  }, [open, prescription, form]);

  const pickTemplate = (templateId: string | undefined) => {
    const template = templates.find((option) => option.id === templateId);
    if (!template) return;
    setLines(linesOfTemplate(template));
    if (template.description) form.setFieldValue("note", template.description);
  };

  const filledLines = lines.filter((line) => line.medicineEntryId);
  const canSave =
    Boolean(staffId) &&
    filledLines.length > 0 &&
    (!saveAsTemplate || templateName.trim().length > 0);
  const saving = create.isPending || update.isPending;

  const submit = async (values: FormValues) => {
    const input: UpdatePrescriptionRequest = {
      staffId: values.staffId ?? "",
      diagnosisText: values.diagnosisText.trim() || null,
      note: values.note.trim() || null,
      treatmentType: values.treatmentType,
      followUpDate: values.followUpDate ? values.followUpDate.format("YYYY-MM-DD") : null,
      saveAsTemplate: values.saveAsTemplate,
      templateName: values.saveAsTemplate ? values.templateName.trim() : null,
      items: filledLines.map((line) => ({
        medicationId: line.medicineEntryId,
        timesPerDay: line.timesPerDay,
        amountPerTime: line.amountPerTime,
        days: line.days,
        usage: line.usage,
        otherUsage: line.otherUsage,
      })),
    };

    try {
      if (prescription) {
        await update.mutateAsync({ id: prescription.id, input });
        toast.success(t("Đã cập nhật đơn thuốc"));
      } else {
        await create.mutateAsync({ ...input, patientId: patient.id, clinicBranchId: branchId });
        toast.success(t("Đã tạo đơn thuốc"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      title={prescription ? t("Cập nhật đơn thuốc") : t("Thêm đơn thuốc")}
      width={1024}
      centered
      className="rx-dialog"
      canSave={canSave}
      saving={saving}
      cancelLabel={t("Hủy")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={EMPTY_FORM}
        onFinish={(values) => void submit(values)}
      >
        {/* Two columns on a wide screen, as on the reference: the patient and
            the template picker on the left, the doctor and diagnosis on the
            right; then lời dặn beside Điều trị / Tái khám. Read top to bottom
            on a narrow one, the cells fall into the reference's single-column
            order. */}
        <div className="rx-grid">
          <div className="rx-cell">
            <PrescriptionPatientBlock patient={patient} />
            <div className="rx-template-row">
              <Form.Item name="templateId" noStyle>
                <Select
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  placeholder={t("Chọn đơn thuốc mẫu")}
                  aria-label={t("Chọn đơn thuốc mẫu")}
                  prefix={<SearchOutlined />}
                  notFoundContent={t("Không tìm thấy dữ liệu")}
                  options={templates.map((template) => ({ value: template.id, label: template.name }))}
                  onChange={pickTemplate}
                />
              </Form.Item>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate("/taxonomy/medicine")}
              >
                {t("Thêm loại thuốc")}
              </Button>
            </div>
          </div>

          <div className="rx-cell">
            <Form.Item
              name="staffId"
              rules={[{ required: true, message: t("Vui lòng chọn bác sĩ") }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={
                  <>
                    {t("Chọn bác sĩ")}
                    <span className="rx-required">*</span>
                  </>
                }
                aria-label={t("Chọn bác sĩ")}
                prefix={<SearchOutlined />}
                options={dentists.map((dentist) => ({ value: dentist.id, label: dentist.name }))}
              />
            </Form.Item>
            <Form.Item name="diagnosisText">
              <Input.TextArea
                rows={3}
                placeholder={t("Nhập chẩn đoán")}
                aria-label={t("Nhập chẩn đoán")}
                maxLength={500}
              />
            </Form.Item>
          </div>

          <div className="rx-cell">
            <Form.Item name="note">
              <Input
                placeholder={t("Nhập lời dặn")}
                aria-label={t("Nhập lời dặn")}
                maxLength={1000}
              />
            </Form.Item>
            <div className="rx-template-save-row">
              <Form.Item name="saveAsTemplate" valuePropName="checked">
                <Checkbox>{t("Lưu đơn thuốc mẫu")}</Checkbox>
              </Form.Item>
              {saveAsTemplate && (
                <FloatingField
                  name="templateName"
                  label={t("Tên đơn thuốc mẫu")}
                  required
                  rules={[
                    { required: true, whitespace: true, message: t("Vui lòng nhập tên đơn thuốc mẫu") },
                  ]}
                >
                  <Input maxLength={200} />
                </FloatingField>
              )}
            </div>
          </div>

          <div className="rx-cell">
            <FloatingField name="treatmentType" label={t("Điều trị")}>
              <Select showSearch optionFilterProp="label" options={treatmentTypeOptions()} />
            </FloatingField>
            <Form.Item name="followUpDate">
              <DatePicker
                format="DD/MM/YYYY"
                placeholder={t("Tái khám")}
                aria-label={t("Tái khám")}
                className="rx-full"
                disabledDate={(date) => date.isBefore(dayjs(), "day")}
              />
            </Form.Item>
          </div>
        </div>

        <PrescriptionLineEditor lines={lines} medicines={medicines} onChange={setLines} paged />
      </Form>
    </AppDialog>
  );
}
