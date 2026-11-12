import type { ReactNode } from "react";
import { DatePicker, Input, Radio, Select } from "antd";
import { t } from "@/lib/i18n";
import { LABO_CASE_TYPE } from "@/features/labo/api/laboApi";

/**
 * Thông tin phiếu in the preview (R-1202): the markup of RequestSlipInfo on a
 * new slip — Mã số still blank and marked, Loại phiếu on Ca mới, the read-only
 * parts grey — with no patient behind it. The preview is inert, so nothing
 * here takes input.
 */
function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "rs-span2" : undefined}>
      <span className="rs-lbl">
        {t(label)} {required && <span className="rs-req">*</span>}
      </span>
      {children}
    </div>
  );
}

const ReadOnly = () => <div className="rs-ro" />;

export function PreviewSlipInfo({ title }: { title: string }) {
  return (
    <section className="rs-sec">
      <div className="rs-sech">{title}</div>
      <div className="rs-secb rs-info">
        <Field label="Labo:Slip:SlipNo" required wide>
          <Input className="rs-inp rs-err" tabIndex={-1} placeholder={t("Labo:Slip:SlipNoPlaceholder")} />
        </Field>
        <Field label="Labo:Slip:CaseType" required wide>
          <Radio.Group className="rs-radios" value={LABO_CASE_TYPE.New}>
            <Radio value={LABO_CASE_TYPE.New}>{t("Labo:Slip:CaseNew")}</Radio>
            <Radio value={LABO_CASE_TYPE.Redo}>{t("Labo:Slip:CaseRedo")}</Radio>
          </Radio.Group>
        </Field>
        <Field label="Labo:Slip:Clinic" wide>
          <ReadOnly />
        </Field>
        <Field label="Labo:Slip:Patient" wide>
          <ReadOnly />
        </Field>
        <Field label="Labo:Slip:Dentist" required>
          <Select className="rs-inp rs-err" placeholder={t("Labo:Slip:DentistPlaceholder")} />
        </Field>
        <Field label="Labo:Slip:AgeGender">
          <ReadOnly />
        </Field>
        <Field label="Labo:Slip:SentAt" required>
          <DatePicker className="rs-inp" format="DD/MM/YYYY" />
        </Field>
        <Field label="Labo:Slip:DueAt" required>
          <DatePicker className="rs-inp" format="DD/MM/YYYY" />
        </Field>
      </div>
    </section>
  );
}
