import { Checkbox, DatePicker, Form, Input, Radio } from "antd";
import dayjs from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";
import { DATE_INPUT_FORMAT } from "@/utils/dateInput";
import type { GuardianCandidate } from "../../types/patient";
import { GuardianRelationField } from "./GuardianRelationField";
import { GuardianSearch } from "./GuardianSearch";

interface Props {
  index: number;
  /** "Lấy theo: …" — the patient's address as the hồ sơ dialog currently holds it. */
  patientAddress: string;
  excludePatientId?: string;
  onPick: (found: GuardianCandidate) => void;
  onPrimaryChange: (checked: boolean) => void;
}

const notFuture = (date: dayjs.Dayjs) => date.isAfter(dayjs(), "day");

/** One guardian's fields, addressed into the popup form at `guardians[index]`. */
export function GuardianForm({ index, patientAddress, excludePatientId, onPick, onPrimaryChange }: Props) {
  const occupations = useCatalogOptions(CATALOG_GROUP.Occupation);
  const form = Form.useFormInstance();
  const field = (name: string) => ["guardians", index, name];
  const sameAddress: boolean | undefined = Form.useWatch(field("sameAddressAsPatient"), form);
  const requiredRule = (message: string) => ({ required: true, whitespace: true, message: t(message) });

  return (
    <div className="bd-guardian-form">
      <GuardianSearch excludePatientId={excludePatientId} onPick={onPick} />
      <GuardianRelationField index={index} />

      <h3 className="bd-guardian-section">{t("Patient:Guardian:PersonalSection")}</h3>

      <div className="bd-guardian-grid">
        <FloatingField
          label={t("Patient:Guardian:FullName")}
          name={field("fullName")}
          required
          alwaysFloat
          rules={[requiredRule("Patient:Guardian:FullNameRequired")]}
        >
          <Input maxLength={200} placeholder={t("Patient:Guardian:FullNameHint")} />
        </FloatingField>

        <FloatingField
          label={t("Patient:Guardian:Phone")}
          name={field("phone")}
          required
          alwaysFloat
          rules={[
            requiredRule("Patient:Guardian:PhoneRequired"),
            { pattern: /^\d{8,15}$/, message: t("Patient:Guardian:PhoneInvalid") },
          ]}
        >
          <Input inputMode="numeric" maxLength={15} placeholder={t("Patient:Guardian:PhoneHint")} />
        </FloatingField>

        <FloatingField
          label={t("Patient:Guardian:NationalId")}
          name={field("nationalId")}
          required
          alwaysFloat
          rules={[requiredRule("Patient:Guardian:NationalIdRequired")]}
        >
          <Input maxLength={20} placeholder={t("Patient:Guardian:NationalIdHint")} />
        </FloatingField>

        <FloatingField label={t("Patient:Guardian:DateOfBirth")} name={field("dateOfBirth")} alwaysFloat>
          <DatePicker format={DATE_INPUT_FORMAT} disabledDate={notFuture} placeholder={t("Patient:Guardian:DateHint")} />
        </FloatingField>

        <FloatingField label={t("Patient:Guardian:IdIssuedOn")} name={field("idIssuedOn")} alwaysFloat>
          <DatePicker format={DATE_INPUT_FORMAT} disabledDate={notFuture} placeholder={t("Patient:Guardian:DateHint")} />
        </FloatingField>

        <FloatingField label={t("Patient:Guardian:IdIssuedPlace")} name={field("idIssuedPlace")} alwaysFloat>
          <Input maxLength={200} placeholder={t("Patient:Guardian:IdIssuedPlaceHint")} />
        </FloatingField>

        <Form.Item name={field("gender")} label={t("Patient:Col:Gender")} className="bd-guardian-gender">
          <Radio.Group>
            <Radio value="male">{t("Nam")}</Radio>
            <Radio value="female">{t("Patient:Misc:Female")}</Radio>
            <Radio value="other">{t("Patient:Misc:OtherLabel")}</Radio>
          </Radio.Group>
        </Form.Item>

        <FloatingField
          label={t("Email")}
          name={field("email")}
          alwaysFloat
          rules={[{ type: "email", message: t("Patient:Form:InvalidEmail") }]}
        >
          <Input type="email" maxLength={256} placeholder={t("Patient:Guardian:EmailHint")} />
        </FloatingField>

        <FloatingField label={t("Patient:Col:Occupation")} name={field("occupationEntryId")} alwaysFloat>
          <SearchSelect
            options={(occupations.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
            placeholder={t("Patient:Guardian:OccupationHint")}
            emptyText={t("Patient:Form:OccupationNotFound")}
            allowClear
          />
        </FloatingField>
      </div>

      <Form.Item name={field("sameAddressAsPatient")} valuePropName="checked" className="bd-guardian-sameaddress">
        <Checkbox>
          <strong>{t("Patient:Guardian:SameAddress")}</strong>
          <span className="bd-guardian-hint">{t("Patient:Guardian:AddressFrom", patientAddress || "—")}</span>
        </Checkbox>
      </Form.Item>

      {sameAddress === false && (
        <FloatingField label={t("Patient:Guardian:Address")} name={field("address")}>
          <Input maxLength={500} />
        </FloatingField>
      )}

      <Form.Item name={field("isPrimaryContact")} valuePropName="checked" className="bd-guardian-check">
        <Checkbox onChange={(event) => onPrimaryChange(event.target.checked)}>
          {t("Patient:Guardian:SetPrimary")}
        </Checkbox>
      </Form.Item>
    </div>
  );
}
