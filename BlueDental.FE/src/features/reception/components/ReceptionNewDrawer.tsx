import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateReception } from "../api/receptionMutations";
import { usePatientList } from "@/features/patient-management/api/patientQueries";
import { useDebounce } from "@/hooks/useDebounce";
import { SearchSelect } from "@/components/SearchSelect";
import type { RefType } from "../types/reception";
import { t } from "@/lib/i18n";

/** The translator, so helpers below can take it as a parameter. */
type Translate = (vietnamese: string, ...params: (string | number)[]) => string;

function createSchema(t: Translate) {
  return z.object({
    patientId: z.string().optional(),
    patientName: z.string().min(1, t("Vui lòng chọn khách hàng")),
    phoneNumber: z.string().optional(),
    doctorId: z.string().min(1, t("Vui lòng chọn bác sĩ")),
    appointmentHour: z.string().optional(),
    appointmentMinute: z.string().optional(),
    notes: z.string().optional(),
  });
}

type FormValues = z.infer<ReturnType<typeof createSchema>>;

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
  const schema = useMemo(() => createSchema(t), []);
  const createMutation = useCreateReception();
  const [selectedPhone, setSelectedPhone] = useState<string>("---");
  const [patientKeyword, setPatientKeyword] = useState("");
  const debouncedPatientKeyword = useDebounce(patientKeyword);

  const { data: patientData } = usePatientList({
    keyword: debouncedPatientKeyword || undefined,
    maxResultCount: 20,
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
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
    const patient = patientData?.items.find((p) => p.id === patientId);
    if (patient) {
      setValue("patientName", patient.fullName, { shouldValidate: true });
      setValue("patientId", patient.id);
      setSelectedPhone(patient.phone ?? "---");
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
        services: [t("Khám tư vấn ban đầu")],
      },
      {
        onSuccess: () => {
          toast.success(t("Tạo tiếp nhận thành công!"));
          reset();
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
    reset();
    setSelectedPhone("---");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent style={{ maxWidth: 620 }}>
        <DialogHeader>
          <DialogTitle>{t("Tạo tiếp nhận")}</DialogTitle>
        </DialogHeader>

        <div className="rn-form">
          {/* Patient select + Tạo Mới */}
          <div className="rn-row">
            <div className="rn-field rn-field--flex1">
              <label className="rn-label rn-label--required">{t("Khách hàng")}</label>
              <Controller
                name="patientId"
                control={control}
                render={({ field }) => (
                  <SearchSelect
                    value={field.value || undefined}
                    placeholder={t("Tìm kiếm khách hàng")}
                    options={(patientData?.items ?? []).map((p) => ({
                      value: p.id,
                      label: `[${p.code}] - ${p.fullName.toUpperCase()}`,
                    }))}
                    onSearch={setPatientKeyword}
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
          <div className="rn-field">
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
                  <div className="relative" style={{ height: 40 }}>
                    <Input
                      {...field}
                      style={{ height: 40 }}
                    />
                    <svg className="absolute right-2 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 6v6h4"/>
                    </svg>
                  </div>
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
                <textarea
                  {...field}
                  rows={4}
                  placeholder={t("Nội dung đặt lịch")}
                  style={{ resize: "none", width: "100%", padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 14 }}
                />
              )}
            />
          </div>

          {/* Footer */}
          <div className="rn-footer">
            <Button
              disabled={createMutation.isPending}
              onClick={handleSubmit(onSubmit)}
              style={{ background: "#2671D8", height: 40, fontWeight: 600, paddingLeft: 20, paddingRight: 20 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              {t("Lưu")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
