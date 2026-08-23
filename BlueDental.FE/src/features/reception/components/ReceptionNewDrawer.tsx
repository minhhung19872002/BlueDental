import React, { useState } from "react";
import { Modal, Button, Input, message } from "antd";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateReception } from "../api/receptionMutations";
import { usePatientOptions } from "@/hooks/usePatientOptions";
import { SearchSelect } from "@/components/SearchSelect";
import type { RefType } from "../types/reception";
import { t } from "@/lib/i18n";

const buildSchema = () =>
  z.object({
  patientId: z.string().optional(),
  patientName: z.string().min(1, t("Vui lòng chọn khách hàng")),
  phoneNumber: z.string().optional(),
  doctorId: z.string({ error: t("Vui lòng chọn bác sĩ") }).min(1, t("Vui lòng chọn bác sĩ")),
  appointmentHour: z.string().optional(),
  appointmentMinute: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

interface DoctorOption {
  id: string;
  name: string;
  title: string;
}

interface ReceptionNewDrawerProps {
  open: boolean;
  doctors: DoctorOption[];
  onClose: () => void;
}


export const ReceptionNewDrawer: React.FC<ReceptionNewDrawerProps> = ({
  open,
  doctors,
  onClose,
}) => {
  const createMutation = useCreateReception();
  const { data: patients } = usePatientOptions();
  const [selectedPhone, setSelectedPhone] = useState<string>("---");

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(buildSchema()),
    defaultValues: {
      patientId: undefined,
      patientName: "",
      phoneNumber: "",
      doctorId: undefined,
      appointmentHour: new Date().getHours().toString().padStart(2, "0"),
      appointmentMinute: "00",
      notes: "",
    },
  });

  const handlePatientChange = (patientId: string) => {
    const patient = (patients ?? []).find((p) => p.id === patientId);
    if (patient) {
      setValue("patientName", patient.name, { shouldValidate: true });
      setValue("patientId", patient.id);
      setSelectedPhone(patient.phone);
    }
  };

  const onSubmit = (data: FormValues) => {
    createMutation.mutate(
      {
        patientId: data.patientId,
        patientName: data.patientName,
        phoneNumber: data.phoneNumber ?? "",
        doctorId: data.doctorId,
        refType: "Self" as RefType,
        notes: data.notes,
        services: ["Khám tư vấn ban đầu"],
      },
      {
        onSuccess: () => {
          message.success(t("Tạo tiếp nhận thành công!"));
          reset();
          setSelectedPhone("---");
          onClose();
        },
        onError: (err) => {
          message.error(err.message || t("Tạo tiếp nhận thất bại"));
        },
      },
    );
  };

  const handleClose = () => {
    reset();
    setSelectedPhone("---");
    onClose();
  };

  return (
    <Modal
      title={t("Tạo tiếp nhận")}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={620}
      centered
      styles={{
        header: { paddingBottom: 8 },
        body: { paddingTop: 8 },
      }}
    >
      <div className="rn-form">
        {/* Patient select + Tạo Mới */}
        <div className="rn-row">
          <div className="rn-field rn-field--flex1" data-testid="reception-patient">
            <label className="rn-label rn-label--required">{t("Khách hàng")}</label>
            <Controller
              name="patientId"
              control={control}
              render={({ field }) => (
                <SearchSelect
                  value={field.value || undefined}
                  placeholder={t("Tìm kiếm khách hàng")}
                  options={(patients ?? []).map((p) => ({
                    value: p.id,
                    label: `[${p.code}] - ${p.name.toUpperCase()}`,
                  }))}
                  onChange={(val) => {
                    field.onChange(val ?? "");
                    if (val) handlePatientChange(val);
                  }}
                  status={errors.patientName ? "error" : ""}
                />
              )}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <span style={{ display: "block", height: 21, marginBottom: 4 }} />
            <Button
              type="primary"
              style={{ background: "#2671D8", height: 40, fontWeight: 600 }}
            >
              {t("Tạo Mới")}
            </Button>
          </div>
        </div>

        {/* Phone */}
        <div className="rn-phone-row">
          <span className="rn-phone-label">{t("Số điện thoại:")}</span>
          <span className="rn-phone-value">{selectedPhone}</span>
        </div>

        {/* Doctor select */}
        <div className="rn-field" data-testid="reception-doctor">
          <label className="rn-label">{t("Bác sĩ điều trị")}</label>
          <Controller
            name="doctorId"
            control={control}
            render={({ field }) => (
              <SearchSelect
                value={field.value || undefined}
                placeholder={t("Chọn bác sĩ")}
                options={doctors.map((d) => ({ value: d.id, label: d.name }))}
                onChange={(val) => field.onChange(val ?? "")}
                status={errors.doctorId ? "error" : ""}
              />
            )}
          />
          {errors.doctorId && <span className="rn-error">{errors.doctorId.message}</span>}
        </div>

        {/* Time row */}
        <div className="rn-time-row">
          <div className="rn-field rn-field--flex1">
            <label className="rn-label">{t("Giờ hẹn")}</label>
            <Controller
              name="appointmentHour"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  style={{ height: 40 }}
                  suffix={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 6v6h4"/>
                    </svg>
                  }
                />
              )}
            />
          </div>
          <div className="rn-field rn-field--flex1">
            <label className="rn-label">{t("Phút")}</label>
            <Controller
              name="appointmentMinute"
              control={control}
              render={({ field }) => (
                <Input {...field} style={{ height: 40 }} />
              )}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="rn-field">
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Input.TextArea
                {...field}
                rows={4}
                placeholder={t("Nội dung đặt lịch")}
                style={{ resize: "none" }}
              />
            )}
          />
        </div>

        {/* Footer */}
        <div className="rn-footer">
          <Button
            type="primary"
            loading={createMutation.isPending}
            onClick={handleSubmit(onSubmit)}
            style={{ background: "#2671D8", height: 40, fontWeight: 600, paddingLeft: 20, paddingRight: 20 }}
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
    </Modal>
  );
};
