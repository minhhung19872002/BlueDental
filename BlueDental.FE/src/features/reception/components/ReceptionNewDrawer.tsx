import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal, Button, Form } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { DentistOverlapDialog } from "@/components/DentistOverlapDialog";
import { NotesPanel } from "@/components/NotesPanel";
import { useCreateReception } from "../api/receptionMutations";
import { useAvailableReceptionDoctors } from "../api/receptionQueries";
import { useDentistOverlapConfirm } from "@/hooks/useDentistOverlapConfirm";
import { usePatientPicker } from "@/hooks/usePatientOptions";
import { PatientEditorDialog } from "@/features/patient-management/components/PatientEditorDialog";
import type { PatientDto } from "@/features/patient-management/types/patient";
import type { CreateReceptionInput, RefType } from "../types/reception";
import { t } from "@/lib/i18n";
import { ReceptionNewFields } from "./ReceptionNewFields";

interface ReceptionNewDrawerProps {
  open: boolean;
  branchId?: string;
  /** The date selected on the toolbar calendar — combined with the time picker. */
  scheduledDate: Dayjs;
  onClose: () => void;
}

interface FormValues {
  patientId?: string;
  doctorId?: string;
  appointmentDate: Dayjs;
  appointmentTime: Dayjs;
  durationMinutes: number;
  /** Nội dung đặt lịch. */
  content?: string;
  /** Ghi chú — the right-hand card, as on the booking dialog (R-1037). */
  notes?: string;
}

export const ReceptionNewDrawer: React.FC<ReceptionNewDrawerProps> = ({
  open,
  branchId,
  scheduledDate,
  onClose,
}) => {
  const [form] = Form.useForm<FormValues>();
  const createMutation = useCreateReception();
  const overlap = useDentistOverlapConfirm();
  const [selectedPhone, setSelectedPhone] = useState<string>("---");
  const [newPatientOpen, setNewPatientOpen] = useState(false);

  // Only doctors not registered OFF on the visit's day (BA 2026-10-02).
  const watchedDate = Form.useWatch("appointmentDate", form);
  const watchedDoctorId = Form.useWatch("doctorId", form);
  const visitDay = open ? (watchedDate ?? scheduledDate).format("YYYY-MM-DD") : undefined;
  const doctorsQuery = useAvailableReceptionDoctors(branchId, visitDay);
  const doctors = useMemo(() => doctorsQuery.data ?? [], [doctorsQuery.data]);
  const doctorOptions = useMemo(() => doctors.map((d) => ({ value: d.id, label: d.name })), [doctors]);
  const doctorIsOff =
    doctorsQuery.isSuccess && !doctorsQuery.isFetching && Boolean(watchedDoctorId)
    && !doctors.some((d) => d.id === watchedDoctorId);

  useEffect(() => {
    if (!doctorIsOff) return;
    form.setFields([{ name: "doctorId", value: undefined, errors: [t("Appointment:Form:DoctorOffOnDate")] }]);
  }, [doctorIsOff, form]);

  // Search hits paged in as the list scrolls; the picked patient must survive a
  // new keyword, or the picker shows a raw id and the save loses name and phone.
  const watchedPatientId = Form.useWatch("patientId", form);
  const patientPicker = usePatientPicker(watchedPatientId, { branchId });
  const patientOptions = useMemo(
    () =>
      patientPicker.patients.map((p) => ({
        value: p.id,
        label: `[${p.code}] - ${p.name.toUpperCase()}`,
        phone: p.phone || undefined,
        name: p.name,
      })),
    [patientPicker.patients],
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
    patientPicker.search(created.fullName ?? "");
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
    const date = data.appointmentDate ?? scheduledDate;
    const scheduledAt = date
      .hour(time.hour())
      .minute(time.minute())
      .second(0)
      .millisecond(0)
      .toISOString();

    create({
      overrideBranchId: resolveBranchId(data.doctorId),
      patientId: data.patientId,
      patientName: patient?.name ?? "",
      phoneNumber: patient?.phone ?? "",
      doctorId: data.doctorId ?? "",
      refType: "Self" as RefType,
      content: data.content,
      notes: data.notes || undefined,
      services: [t("Reception:DefaultService")],
      scheduledAt,
      estimatedDurationMinutes: data.durationMinutes,
    });
  };

  // The dentist already holding a visit then is only a warning: Xác nhận
  // resends with `allowDentistOverlap`, Hủy leaves the form as it is. Any
  // other error the global handler has already reported.
  const create = (input: CreateReceptionInput) => {
    createMutation.mutate(
      input,
      {
        onError: (error) => {
          overlap.intercept(error, () => create({ ...input, allowDentistOverlap: true }));
        },
        onSuccess: () => {
          toast.success(t("Reception:CreateSuccess"));
          form.resetFields();
          setSelectedPhone("---");
          onClose();
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
      title={t("Reception:CreateTitle")}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={1000}
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
          appointmentDate: scheduledDate,
          appointmentTime: dayjs(),
          durationMinutes: 15,
        }}
      >
        <div className="rn-layout">
          <ReceptionNewFields
            patientPicker={patientPicker}
            patientOptions={patientOptions}
            doctorOptions={doctorOptions}
            selectedPhone={selectedPhone}
            onPatientChange={handlePatientChange}
            onCreatePatient={() => setNewPatientOpen(true)}
          />
          <Form.Item name="notes" noStyle>
            <NotesPanel />
          </Form.Item>
        </div>

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
            {t("Common:Save")}
          </Button>
        </div>
      </Form>

      <DentistOverlapDialog {...overlap.dialog} />

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
