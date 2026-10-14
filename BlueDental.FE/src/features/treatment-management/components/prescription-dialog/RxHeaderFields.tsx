import { DatePicker, Form, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { RequiredPlaceholder } from "@/components/RequiredPlaceholder";
import { ServerSearchSelect } from "@/components/ServerSearchSelect";
import { useDentistOptions } from "@/hooks/usePickerOptions";
import { t } from "@/lib/i18n";
import { DATE_INPUT_FORMAT } from "@/utils/dateInput";
import { treatmentTypeOptions } from "../../api/prescriptionApi";
import type { PrescriptionPatientSummary } from "../../types/prescription";
import { PrescriptionPatientBlock } from "../PrescriptionPatientBlock";

const isPastDay = (date: Dayjs) => date.isBefore(dayjs(), "day");
/** A prescription may be dated back, never ahead (owner 2026-10-14). */
const isFutureDay = (date: Dayjs) => date.isAfter(dayjs(), "day");

/**
 * The top of the dialog: the patient on the left; on the right the
 * prescribing doctor over Điều trị and Tái khám side by side (F-58 mock),
 * and "Ngày lên đơn thuốc" under Điều trị — the day the printed slip carries.
 */
export function RxHeaderFields({ patient }: { patient: PrescriptionPatientSummary }) {
  return (
    <div className="rx-head">
      <PrescriptionPatientBlock patient={patient} />
      <div className="rx-head-fields">
        <Form.Item
          name="staffId"
          rules={[{ required: true, message: t("Treatment:Common:DoctorRequired") }]}
        >
          {/* "Chọn bác sĩ*" — the field names itself in its placeholder. */}
          <ServerSearchSelect
            aria-label={t("Treatment:Common:SelectDoctor")}
            placeholder={<RequiredPlaceholder text={t("Treatment:Common:SelectDoctor")} />}
            allowClear={false}
            useOptions={useDentistOptions}
            notFoundText={t("Treatment:Common:DoctorNotFound")}
          />
        </Form.Item>
        <div className="rx-head-pair">
          <FloatingField name="treatmentType" label={t("Treatment:Prescription:TypeTreatment")}>
            <Select showSearch optionFilterProp="label" options={treatmentTypeOptions()} />
          </FloatingField>
          <Form.Item name="followUpDate">
            <DatePicker
              format={DATE_INPUT_FORMAT}
              placeholder={t("Treatment:Prescription:TypeRecheck")}
              aria-label={t("Treatment:Prescription:TypeRecheck")}
              className="rx-full"
              disabledDate={isPastDay}
            />
          </Form.Item>
          <FloatingField
            name="prescribedOn"
            label={t("Treatment:Prescription:PrescribedOn")}
            required
            rules={[{ required: true, message: t("Treatment:Prescription:PrescribedOnRequired") }]}
          >
            <DatePicker
              format={DATE_INPUT_FORMAT}
              aria-label={t("Treatment:Prescription:PrescribedOn")}
              className="rx-full"
              allowClear={false}
              disabledDate={isFutureDay}
            />
          </FloatingField>
        </div>
      </div>
    </div>
  );
}
