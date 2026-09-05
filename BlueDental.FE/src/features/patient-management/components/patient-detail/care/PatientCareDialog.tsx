import { useEffect, useMemo } from "react";
import { DatePicker, Form, Input, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  CARE_STATUS,
  CARE_TYPE,
  useCreateCareRecord,
  useUpdateCareRecord,
  type CareOutcome,
  type CareRecordDto,
} from "@/features/cskh/api/careApi";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import type { PatientDto } from "../../../types/patient";
import { ratingOf } from "./careRating";
import { CareRatingField, StaticField } from "./CareRatingField";

/** The reference's subject for a care record opened from this tab; never shown. */
const SPECIAL_SUBJECT = "Customer Care - special";

interface CareValues {
  careDate: Dayjs;
  careTime: Dayjs;
  description?: string;
  assignedStaffId?: string;
  outcome: CareOutcome;
}

interface Props {
  open: boolean;
  patient: PatientDto;
  record: CareRecordDto | null;
  onClose: () => void;
}

function toDueAt(value: CareValues): string {
  return value.careDate
    .hour(value.careTime.hour())
    .minute(value.careTime.minute())
    .second(0)
    .millisecond(0)
    .toISOString();
}

/** "Chăm sóc khách hàng" — creates a CSKH đặc biệt, or edits any record of the log. */
export function PatientCareDialog({ open, patient, record, onClose }: Props) {
  const [form] = Form.useForm<CareValues>();
  const create = useCreateCareRecord();
  const update = useUpdateCareRecord();
  const branchId = useCurrentBranchId();
  const user = useAuthStore((state) => state.user);
  const dentistQuery = useDentistList();
  const dentistOptions = useMemo(
    () => (dentistQuery.data ?? []).map((dentist) => ({ value: dentist.id, label: dentist.name })),
    [dentistQuery.data],
  );
  const staffOptions = useMemo(
    () => (user ? [{ value: user.id, label: user.name }] : []),
    [user],
  );
  const patientOptions = useMemo(
    () => [{ value: patient.id, label: `${patient.patientCode} - ${patient.fullName}` }],
    [patient.id, patient.patientCode, patient.fullName],
  );

  useEffect(() => {
    if (!open) return;
    const at = dayjs(record?.dueAt ?? undefined);
    form.setFieldsValue({
      careDate: at,
      careTime: at,
      description: record?.description ?? undefined,
      assignedStaffId: record?.assignedStaffId ?? undefined,
      outcome: ratingOf(record?.outcome).value,
    });
  }, [form, open, record]);

  const handleSave = async () => {
    const value = await form.validateFields();
    // The reference PUTs status "success" with the colour on every save.
    const body = {
      assignedStaffId: value.assignedStaffId,
      careStaffId: user?.id,
      description: value.description,
      dueAt: toDueAt(value),
      status: CARE_STATUS.Succeeded,
      outcome: value.outcome,
    };
    try {
      if (record) await update.mutateAsync({ id: record.id, ...body });
      else
        await create.mutateAsync({
          ...body,
          patientId: patient.id,
          branchId,
          type: CARE_TYPE.Special,
          subject: SPECIAL_SUBJECT,
        });
      toast.success(record ? t("Đã cập nhật nội dung chăm sóc") : t("Đã tạo nội dung chăm sóc"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <AppDialog
      open={open}
      title={record ? t("Cập nhật chăm sóc khách hàng") : t("Chăm sóc khách hàng")}
      width={500}
      className="pc-dialog"
      canSave
      saving={create.isPending || update.isPending}
      onSave={() => void handleSave()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" className="pc-form">
        <div className="pc-form-row">
          <FloatingField
            name="careDate"
            label={t("Ngày chăm sóc")}
            required
            rules={[{ required: true, message: t("Vui lòng chọn ngày chăm sóc") }]}
          >
            <DatePicker format="DD/MM/YYYY" allowClear={false} />
          </FloatingField>
          <FloatingField
            name="careTime"
            label={t("Giờ chăm sóc")}
            required
            rules={[{ required: true, message: t("Vui lòng chọn giờ chăm sóc") }]}
          >
            <TimePicker format="HH:mm" allowClear={false} />
          </FloatingField>
        </div>
        <StaticField label={t("Họ và tên")} required>
          <SearchSelect disabled value={patient.id} options={patientOptions} />
        </StaticField>
        <FloatingField name="description" label={t("Ghi chú lần chăm sóc")}>
          <Input.TextArea rows={4} maxLength={500} />
        </FloatingField>
        <hr className="pc-form-divider" />
        <FloatingField name="assignedStaffId" label={t("Bác sĩ tiếp nhận")}>
          <SearchSelect options={dentistOptions} allowClear />
        </FloatingField>
        <StaticField label={t("Nhân viên chăm sóc")} required>
          <SearchSelect disabled value={user?.id} options={staffOptions} />
        </StaticField>
        <CareRatingField />
      </Form>
    </AppDialog>
  );
}
