import { Button, Input, InputNumber, Select, DatePicker } from "antd";
import { TimePicker } from "@/components/TimePicker";
import { FloatingField } from "@/components/FloatingField";
import { pagedSelectProps } from "@/components/pagedSelectProps";
import type { usePatientPicker } from "@/hooks/usePatientOptions";
import { CLINIC_HOURS_PICKER_PROPS } from "@/utils/clinicHours";
import { DATE_INPUT_FORMAT } from "@/utils/dateInput";
import { t } from "@/lib/i18n";

interface Option {
  value: string;
  label: string;
}

interface ReceptionNewFieldsProps {
  patientPicker: ReturnType<typeof usePatientPicker>;
  patientOptions: Option[];
  doctorOptions: Option[];
  selectedPhone: string;
  onPatientChange: (patientId: string) => void;
  onCreatePatient: () => void;
}

/** Tạo tiếp nhận's left column: who, with whom, when and what for. */
export function ReceptionNewFields({
  patientPicker,
  patientOptions,
  doctorOptions,
  selectedPhone,
  onPatientChange,
  onCreatePatient,
}: ReceptionNewFieldsProps) {
  return (
    <div className="rn-form">
      {/* Patient select + Tạo Mới */}
      <div className="rn-row">
        <div className="rn-field rn-field--flex1">
          <FloatingField
            label={t("Reception:ColCustomer")}
            name="patientId"
            required
            rules={[{ required: true, message: t("Reception:CustomerRequired") }]}
          >
            <Select
              showSearch
              filterOption={false}
              onSearch={patientPicker.search}
              onChange={onPatientChange}
              {...pagedSelectProps(patientPicker)}
              options={patientOptions}
            />
          </FloatingField>
        </div>
        <Button type="primary" className="rn-create-btn" onClick={onCreatePatient}>
          {t("Reception:CreateNew")}
        </Button>
      </div>

      {/* Phone */}
      <div className="rn-phone-row">
        <span className="rn-phone-label">{t("Reception:PhoneLabel")}</span>
        <span className="rn-phone-value">{selectedPhone}</span>
      </div>

      {/* Doctor select */}
      <FloatingField
        label={t("Reception:TreatingDoctor")}
        name="doctorId"
        required
        rules={[{ required: true, message: t("Reception:DoctorRequired") }]}
      >
        <Select
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
          }
          options={doctorOptions}
        />
      </FloatingField>

      {/* Date */}
      <FloatingField label={t("Reception:AppointmentDate")} name="appointmentDate">
        <DatePicker format={DATE_INPUT_FORMAT} style={{ width: "100%" }} allowClear={false} />
      </FloatingField>

      {/* Time + duration */}
      <div className="rn-time-row">
        <div className="rn-field rn-field--flex1">
          <FloatingField label={t("Reception:AppointmentTime")} name="appointmentTime">
            <TimePicker format="HH:mm" style={{ width: "100%" }} {...CLINIC_HOURS_PICKER_PROPS} />
          </FloatingField>
        </div>
        <div className="rn-field rn-field--flex1">
          <FloatingField label={t("Reception:Minutes")} name="durationMinutes">
            <InputNumber min={5} max={480} step={5} style={{ width: "100%" }} />
          </FloatingField>
        </div>
      </div>

      {/* Nội dung đặt lịch */}
      <FloatingField label={t("Reception:BookingNotes")} name="content">
        <Input.TextArea rows={4} style={{ resize: "none" }} />
      </FloatingField>
    </div>
  );
}
