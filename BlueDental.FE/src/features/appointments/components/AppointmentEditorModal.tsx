import { useEffect, useState } from "react";
import { Button, DatePicker, Form, Input, InputNumber, Select, TimePicker } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useClinicBranches } from "@/features/organizations/api";
import { useDebounce } from "@/hooks/useDebounce";
import { usePatientOptions } from "@/hooks/usePatientOptions";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { useCreateAppointment, useUpdateAppointment } from "../api/appointmentMutations";
import type { AppointmentColor } from "../types/appointment";
import { AppointmentAgenda } from "./AppointmentAgenda";
import "./appointment.css";

/**
 * "Tạo lịch hẹn" — the reference's booking dialog.
 *
 * A 1240px shell holding three form columns — who and when on the left, the
 * doctor, what it is for and the colour in the middle, the note card on the
 * right — over the clinic's own diary, so the slot can be seen against
 * everything already booked. One right-aligned "Lưu"; no cancel, as the
 * reference has none. See docs/clone/pages/patient-detail.md §Tạo lịch hẹn.
 */

/** One appointment slot, matching the calendar grid and the form's default. */
const SLOT_MINUTES = 30;

const COLOR_SWATCHES: { value: AppointmentColor; label: string }[] = [
  { value: "default", label: "Mặc định" },
  { value: "green", label: "Xanh lá" },
  { value: "orange", label: "Cam" },
  { value: "red", label: "Đỏ" },
];

interface FormValues {
  patientId: string;
  branchId: string | null;
  date: Dayjs;
  startTime: Dayjs;
  durationMinutes: number;
  doctorId: string;
  reason: string;
  color: AppointmentColor;
  notes: string;
}

interface Props {
  open: boolean;
  appointmentId?: string | null;
  /**
   * What the form opens with. The calendar seeds the slot it was clicked on,
   * and a patient screen seeds the patient it belongs to, so neither makes the
   * user pick again something they have already said.
   */
  initialPatientId?: string;
  initialDoctorId?: string;
  initialDate?: string;
  initialTime?: string;
  initialEndTime?: string;
  initialReason?: string;
  initialNotes?: string;
  initialColor?: AppointmentColor;
  /** Locks the patient field, the way opening from a patient's own screen does. */
  lockPatient?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AppointmentEditorModal({
  open,
  appointmentId,
  initialPatientId,
  initialDoctorId,
  initialDate,
  initialTime,
  initialEndTime,
  initialReason,
  initialNotes,
  initialColor,
  lockPatient,
  onClose,
  onSuccess,
}: Props) {
  const isEdit = Boolean(appointmentId);
  const [form] = Form.useForm<FormValues>();
  const [patientKeyword, setPatientKeyword] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);

  const branchId = useCurrentBranchId();
  const createMutation = useCreateAppointment();
  const updateMutation = useUpdateAppointment(appointmentId ?? "");
  const saving = createMutation.isPending || updateMutation.isPending;

  const patients = usePatientOptions(useDebounce(patientKeyword, 300));
  const dentists = useDentistList();
  const branches = useClinicBranches(true);

  const patientId = Form.useWatch("patientId", form);
  const doctorId = Form.useWatch("doctorId", form);
  const date = Form.useWatch("date", form);
  const startTime = Form.useWatch("startTime", form);
  const duration = Form.useWatch("durationMinutes", form);
  const color = Form.useWatch("color", form) ?? "default";
  const notes = Form.useWatch("notes", form) ?? "";

  /**
   * What the form opens with.
   *
   * Handed to the Form as `initialValues` rather than pushed in from an effect:
   * the modal mounts its children in a portal a commit later than the parent's
   * effect runs, so `setFieldsValue` fired into a form that was not connected
   * yet and the date and time silently stayed empty. The dialog is destroyed on
   * close, so a fresh mount picks these up on every open.
   */
  const seed: FormValues = {
    patientId: initialPatientId ?? "",
    branchId,
    date: initialDate ? dayjs(initialDate) : dayjs(),
    startTime: initialTime ? dayjs(initialTime, "HH:mm") : dayjs(),
    durationMinutes:
      initialTime && initialEndTime
        ? Math.max(dayjs(initialEndTime, "HH:mm").diff(dayjs(initialTime, "HH:mm"), "minute"), 5)
        : SLOT_MINUTES,
    doctorId: initialDoctorId ?? "",
    reason: initialReason ?? "",
    color: initialColor ?? "default",
    notes: initialNotes ?? "",
  };

  useEffect(() => {
    if (!open) return;
    setPatientKeyword("");
    setNoteOpen(Boolean(initialNotes));
  }, [open, initialNotes]);

  /** The slot the form currently describes, or null while it is incomplete. */
  const draftSlot =
    date && startTime
      ? (() => {
          const start = date
            .startOf("day")
            .hour(startTime.hour())
            .minute(startTime.minute())
            .second(0);
          return {
            start: start.format("YYYY-MM-DDTHH:mm:ss"),
            end: start.add(duration || SLOT_MINUTES, "minute").format("YYYY-MM-DDTHH:mm:ss"),
            color,
          };
        })()
      : null;

  const handleSave = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values || !draftSlot) return;

    const payload = {
      patientId: values.patientId,
      doctorId: values.doctorId,
      branchId: branchId ?? undefined,
      startTime: draftSlot.start,
      endTime: draftSlot.end,
      reason: values.reason || undefined,
      notes: values.notes || undefined,
      color: values.color,
    };

    try {
      if (isEdit) await updateMutation.mutateAsync(payload);
      else await createMutation.mutateAsync(payload);

      toast.success(isEdit ? t("Đã cập nhật lịch hẹn") : t("Tạo lịch hẹn thành công!"));
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <AppDialog
      open={open}
      title={isEdit ? t("Sửa lịch hẹn") : t("Tạo lịch hẹn")}
      width={1240}
      className="bd-appt-dialog"
      canSave={Boolean(patientId && doctorId && date && startTime)}
      saving={saving}
      onSave={() => void handleSave()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={seed}
      >
        <div className="bd-appt-form">
          <div className="bd-appt-col">
            <FloatingField
              label={t("Chọn bệnh nhân")}
              name="patientId"
              required
              rules={[{ required: true, message: t("Vui lòng chọn khách hàng") }]}
            >
              <Select
                showSearch
                filterOption={false}
                disabled={lockPatient}
                loading={patients.isLoading}
                onSearch={setPatientKeyword}
                options={(patients.data ?? []).map((patient) => ({
                  value: patient.id,
                  label: `[${patient.code}] - ${patient.name.toUpperCase()}`,
                }))}
              />
            </FloatingField>

            {/* The server books into the branch the session is scoped to, so
                this reports it rather than offering a move that would not take. */}
            <FloatingField label={t("Chi nhánh")} name="branchId">
              <Select
                disabled
                options={(branches.data ?? []).map((branch) => ({
                  value: branch.id,
                  label: branch.name,
                }))}
              />
            </FloatingField>

            <FloatingField
              label={t("Ngày hẹn")}
              name="date"
              required
              rules={[{ required: true, message: t("Vui lòng chọn ngày hẹn") }]}
            >
              <DatePicker format="DD/MM/YYYY" allowClear={false} />
            </FloatingField>

            <div className="bd-appt-timerow">
              <FloatingField
                label={t("Giờ hẹn")}
                name="startTime"
                required
                rules={[{ required: true, message: t("Vui lòng chọn giờ hẹn") }]}
              >
                <TimePicker format="HH:mm" minuteStep={5} allowClear={false} needConfirm={false} />
              </FloatingField>

              <FloatingField
                label={t("Phút")}
                name="durationMinutes"
                rules={[{ type: "number", min: 5, message: t("Tối thiểu 5 phút") }]}
              >
                <InputNumber min={5} max={480} step={5} />
              </FloatingField>
            </div>
          </div>

          <div className="bd-appt-col">
            <FloatingField
              label={t("Chọn bác sĩ")}
              name="doctorId"
              required
              rules={[{ required: true, message: t("Vui lòng chọn bác sĩ") }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                loading={dentists.isLoading}
                options={(dentists.data ?? []).map((dentist) => ({
                  value: dentist.id,
                  label: dentist.name,
                }))}
              />
            </FloatingField>

            <FloatingField label={t("Nội dung đặt lịch")} name="reason">
              <Input.TextArea rows={3} />
            </FloatingField>

            <div className="bd-appt-colors">
              <p>{t("Màu lịch hẹn")}</p>
              <Form.Item name="color" noStyle>
                <ColorSwatches />
              </Form.Item>
            </div>
          </div>

          <div className="bd-appt-col">
            <div className="bd-appt-note">
              <div className="bd-appt-note-head">
                <p>{t("Ghi chú")}</p>
                <Button
                  type="link"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setNoteOpen(true)}
                >
                  {t("Thêm ngay")}
                </Button>
              </div>

              {noteOpen ? (
                <Form.Item name="notes" noStyle>
                  <Input.TextArea
                    rows={4}
                   
                    aria-label={t("Ghi chú")}
                    placeholder={t("Nhập ghi chú cho lịch hẹn")}
                  />
                </Form.Item>
              ) : notes ? (
                <p className="bd-appt-note-text">{notes}</p>
              ) : (
                <p className="bd-appt-note-empty">{t("Chưa có ghi chú")}</p>
              )}
            </div>
          </div>
        </div>

        <AppointmentAgenda
          date={(date ?? dayjs()).format("YYYY-MM-DD")}
          draft={draftSlot}
          onPickDate={(next) => form.setFieldValue("date", dayjs(next))}
        />
      </Form>
    </AppDialog>
  );
}

/**
 * The four swatches, driven as one form field so the selected one is part of
 * the submitted values rather than a second piece of state to keep in step.
 */
function ColorSwatches({
  value = "default",
  onChange,
}: {
  value?: AppointmentColor;
  onChange?: (next: AppointmentColor) => void;
}) {
  return (
    <div className="bd-appt-swatches" role="radiogroup" aria-label={t("Màu lịch hẹn")}>
      {COLOR_SWATCHES.map((swatch) => (
        <button
          key={swatch.value}
          type="button"
          role="radio"
          aria-checked={value === swatch.value}
          aria-label={t(swatch.label)}
          title={t(swatch.label)}
          className={[
            "bd-appt-swatch",
            `bd-appt-swatch--${swatch.value}`,
            value === swatch.value && "bd-appt-swatch--on",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange?.(swatch.value)}
        />
      ))}
    </div>
  );
}
