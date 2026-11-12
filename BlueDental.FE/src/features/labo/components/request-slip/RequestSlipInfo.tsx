import type { ReactNode } from "react";
import { DatePicker, Input, Radio, Select } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { PATIENT_GENDER_CODE, usePatientBrief, type PatientBrief } from "@/hooks/usePatientBrief";
import type { PickerOption } from "@/hooks/useLaboPickers";
import { LABO_CASE_TYPE } from "@/features/labo/api/laboApi";
import { isDueBad, type RequestSlipValues } from "./requestSlipModel";
import { SupplierField } from "./SupplierField";

interface Props {
  branchId: string;
  patient: { id: string; code: string; name: string };
  dentists: PickerOption[];
  values: RequestSlipValues;
  editable: boolean;
  onChange: (patch: Partial<RequestSlipValues>) => void;
  /** The heading a Mẫu phiếu gives this part (F-94); none keeps its own name. */
  title?: string;
}

const DAY_FORMAT = "DD/MM/YYYY";

const GENDER_LABEL: Record<number, string> = {
  [PATIENT_GENDER_CODE.Male]: "Common:Gender:Male",
  [PATIENT_GENDER_CODE.Female]: "Common:Gender:Female",
  [PATIENT_GENDER_CODE.Other]: "Common:Gender:Other",
};

/** "34 tuổi · Nữ", whichever half is known. */
function ageAndGender(brief: PatientBrief | undefined): string {
  if (!brief) return "";
  const age = brief.dateOfBirth ? t("PatientRelation:Age", String(dayjs().diff(brief.dateOfBirth, "year"))) : "";
  const gender = brief.gender !== null && GENDER_LABEL[brief.gender] ? t(GENDER_LABEL[brief.gender]) : "";
  return [age, gender].filter(Boolean).join(" · ");
}

const inputClass = (bad: boolean) => (bad ? "rs-inp rs-err" : "rs-inp");

function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "rs-span2" : undefined}>
      <span className="rs-lbl">
        {label} {required && <span className="rs-req">*</span>}
      </span>
      {children}
    </div>
  );
}

const ReadOnly = ({ label, text }: { label: string; text: string }) => (
  <div className="rs-ro" role="textbox" aria-readonly="true" aria-label={label} title={text}>
    {text}
  </div>
);

/** Thông tin phiếu: what the Labo needs to know about the order, the clinic, patient, doctor and supplier (P1311). */
export function RequestSlipInfo({ branchId, patient, dentists, values, editable, onChange, title }: Props) {
  const clinic = useBranchInfo(branchId).data;
  const brief = usePatientBrief(patient.id).data;
  const dueBad = isDueBad(values);

  return (
    <section className="rs-sec">
      <div className="rs-sech">{title ?? t("Labo:Slip:Info")}</div>
      <div className="rs-secb rs-info">
        <Field label={t("Labo:Slip:SlipNo")} required wide>
          <Input
            className={inputClass(editable && !values.labSlipNo.trim())}
            value={values.labSlipNo}
            maxLength={64}
            disabled={!editable}
            placeholder={t("Labo:Slip:SlipNoPlaceholder")}
            aria-label={t("Labo:Slip:SlipNo")}
            onChange={(event) => onChange({ labSlipNo: event.target.value })}
          />
        </Field>
        <Field label={t("Labo:Slip:CaseType")} required wide>
          <Radio.Group
            className="rs-radios"
            value={values.caseType}
            disabled={!editable}
            aria-label={t("Labo:Slip:CaseType")}
            onChange={(event) => onChange({ caseType: event.target.value })}
          >
            <Radio value={LABO_CASE_TYPE.New}>{t("Labo:Slip:CaseNew")}</Radio>
            <Radio value={LABO_CASE_TYPE.Redo}>{t("Labo:Slip:CaseRedo")}</Radio>
          </Radio.Group>
        </Field>
        <Field label={t("Labo:Slip:Clinic")} wide>
          <ReadOnly label={t("Labo:Slip:Clinic")} text={clinic?.name ?? ""} />
        </Field>
        <Field label={t("Labo:Slip:Patient")} wide>
          <ReadOnly label={t("Labo:Slip:Patient")} text={[patient.code, patient.name].filter(Boolean).join(" – ")} />
        </Field>
        <Field label={t("Labo:Slip:Dentist")} required>
          <Select
            className={inputClass(editable && !values.dentistId)}
            value={values.dentistId}
            options={dentists}
            showSearch={{ optionFilterProp: "label" }}
            disabled={!editable}
            placeholder={t("Labo:Slip:DentistPlaceholder")}
            aria-label={t("Labo:Slip:Dentist")}
            onChange={(dentistId: string) => onChange({ dentistId })}
          />
        </Field>
        <Field label={t("Labo:Slip:AgeGender")}>
          <ReadOnly label={t("Labo:Slip:AgeGender")} text={ageAndGender(brief)} />
        </Field>
        <Field label={t("Labo:Slip:SentAt")} required>
          <DatePicker
            className="rs-inp"
            value={values.sentDate}
            format={DAY_FORMAT}
            allowClear={false}
            disabled={!editable}
            aria-label={t("Labo:Slip:SentAt")}
            onChange={(sentDate) => onChange({ sentDate })}
          />
        </Field>
        <Field label={t("Labo:Slip:DueAt")} required>
          <DatePicker
            className={inputClass(editable && dueBad)}
            value={values.dueDate}
            format={DAY_FORMAT}
            disabled={!editable}
            aria-label={t("Labo:Slip:DueAt")}
            onChange={(dueDate) => onChange({ dueDate })}
          />
          {editable && dueBad && <div className="rs-ferr">{t("Labo:Slip:DueAfterSent")}</div>}
        </Field>
        <SupplierField
          branchId={branchId}
          value={values.supplierId}
          editable={editable}
          onChange={(supplierId) => onChange({ supplierId })}
        />
      </div>
    </section>
  );
}
