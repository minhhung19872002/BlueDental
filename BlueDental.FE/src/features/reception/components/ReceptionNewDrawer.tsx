import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal, Button, Input, InputNumber, Form, Select, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { useCreateReception } from "../api/receptionMutations";
import { usePatientList } from "@/features/patient-management/api/patientQueries";
import { useDebounce } from "@/hooks/useDebounce";
import { PatientEditorDialog } from "@/features/patient-management/components/PatientEditorDialog";
import type { PatientDto } from "@/features/patient-management/types/patient";
import type { RefType } from "../types/reception";
import { t } from "@/lib/i18n";

interface DoctorOption {
  id: string;
  name: string;
  title: string;
  branchIds?: string[];
}

interface ReceptionNewDrawerProps {
  open: boolean;
  doctors: DoctorOption[];
  branchId?: string;
  /** The date selected on the toolbar calendar — combined with the time picker. */
  scheduledDate: Dayjs;
  onClose: () => void;
}

interface FormValues {
  patientId?: string;
  doctorId?: string;
  appointmentTime: Dayjs;
  durationMinutes: number;
  notes?: string;
}

export const ReceptionNewDrawer: React.FC<ReceptionNewDrawerProps> = ({
  open,
  doctors,
  branchId,
  scheduledDate,
  onClose,
}) => {
  const [form] = Form.useForm<FormValues>();
  const createMutation = useCreateReception();
  const [selectedPhone, setSelectedPhone] = useState<string>("---");
  const [patientKeyword, setPatientKeyword] = useState("");
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const debouncedPatientKeyword = useDebounce(patientKeyword);

  const { data: patientData } = usePatientList({
    branchId,
    filter: debouncedPatientKeyword || undefined,
    maxResultCount: 20,
  });

  const patientOptions = useMemo(
    () =>
      (patientData?.items ?? []).map((p) => ({
        value: p.id,
        label: `[${p.patientCode}] - ${p.fullName.toUpperCase()}`,
        phone: p.phoneNumber,
        name: p.fullName,
      })),
    [patientData],
  );

  const handlePatientChange = (patientId: string) => {
    const patient = patientOptions.find((p) => p.value === patientId);
    if (patient) {
      setSelectedPhone(patient.phone ?? "---");
    }
  };

  const handlePatientCreated = (created: PatientDto) => {
    form.setFieldValue("patientId", created.id);
    setSelectedPhone(created.phoneNumber ?? "---");
    setPatientKeyword(created.fullName ?? "");
  };

  const resolveBranchId = (doctorId?: string): string | undefined => {
    if (branchId) return undefined;
    const doctor = doctors.find((d) => d.id === doctorId);
    return doctor?.branchIds?.[0];
  };

  const handleSubmit = async () => {
    const data = await form.validateFields();
    const patient = patientOptions.find((p) => p.value === data.patientId);

    const time = data.appointmentTime ?? dayjs();
    const scheduledAt = scheduledDate
      .hour(time.hour())
      .minute(time.minute())
      .second(0)
      .toISOString();

    createMutation.mutate(
      {
        overrideBranchId: resolveBranchId(data.doctorId),
        patientId: data.patientId,
        patientName: patient?.name ?? "",
        phoneNumber: patient?.phone ?? "",
        doctorId: data.doctorId ?? "",
        refType: "Self" as RefType,
        notes: data.notes,
        services: [t("Khám tư vấn ban đầu")],
        scheduledAt,
        estimatedDurationMinutes: data.durationMinutes,
      },
      {
        onSuccess: () => {
          toast.success(t("Tạo tiếp nhận thành công!"));
          form.resetFields();
          setSelectedPhone("---");
          onClose();
        },
        onError: (err) => {
          toast.error(err.message || t("Tạo tiếp nhận thất bại"));
        },
      },
    );
  };

  const handleClose = () => {
    form.resetFields();
    setSelectedPhone("---");
    onClose();
  };

  return (
    <Modal
      title={t("Tạo tiếp nhận")}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={772}
      centered
      destroyOnHidden
      styles={{
        header: { paddingBottom: 8 },
        body: { paddingTop: 8 },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          appointmentTime: dayjs(),
          durationMinutes: 30,
        }}
      >
        <div className="rn-form">
          {/* Patient select + Tạo Mới */}
          <div className="rn-row">
            <div className="rn-field rn-field--flex1">
              <FloatingField
                label={t("Khách hàng")}
                name="patientId"
                required
                rules={[{ required: true, message: t("Vui lòng chọn khách hàng") }]}
              >
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={setPatientKeyword}
                  onChange={(val: string) => handlePatientChange(val)}
                  options={patientOptions.map((p) => ({
                    value: p.value,
                    label: p.label,
                  }))}
                />
              </FloatingField>
            </div>
            <Button
              type="primary"
              className="rn-create-btn"
              onClick={() => setNewPatientOpen(true)}
            >
              {t("Tạo Mới")}
            </Button>
          </div>

          {/* Phone */}
          <div className="rn-phone-row">
            <span className="rn-phone-label">{t("Số điện thoại:")}</span>
            <span className="rn-phone-value">{selectedPhone}</span>
          </div>

          {/* Doctor select */}
          <FloatingField
            label={t("Bác sĩ điều trị")}
            name="doctorId"
            rules={[{ required: true, message: t("Vui lòng chọn bác sĩ") }]}
          >
            <Select
              showSearch
              filterOption={(input, option) =>
                (option?.label as string ?? "").toLowerCase().includes(input.toLowerCase())
              }
              options={doctors.map((d) => ({ value: d.id, label: d.name }))}
            />
          </FloatingField>

          {/* Time + duration */}
          <div className="rn-time-row">
            <div className="rn-field rn-field--flex1">
              <FloatingField label={t("Giờ hẹn")} name="appointmentTime">
                <TimePicker format="HH:mm" style={{ width: "100%" }} />
              </FloatingField>
            </div>
            <div className="rn-field rn-field--flex1">
              <FloatingField label={t("Phút")} name="durationMinutes">
                <InputNumber min={5} max={480} step={5} style={{ width: "100%" }} />
              </FloatingField>
            </div>
          </div>

          {/* Notes */}
          <FloatingField label={t("Nội dung đặt lịch")} name="notes">
            <Input.TextArea rows={4} style={{ resize: "none" }} />
          </FloatingField>

          {/* Footer */}
          <div className="rn-footer">
            <Button
              type="primary"
              loading={createMutation.isPending}
              onClick={handleSubmit}
              style={{ background: "var(--bd-blue)", height: 40, fontWeight: 600, paddingLeft: 20, paddingRight: 20 }}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                </svg>
              }
            >
              {t("Lưu")}
            </Button>
          </div>
        </div>
      </Form>

      {newPatientOpen && (
        <PatientEditorDialog
          open
          patient={null}
          onClose={() => {
            setNewPatientOpen(false);
          }}
          onCreated={handlePatientCreated}
        />
      )}
    </Modal>
  );
};
