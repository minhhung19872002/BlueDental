import type { CSSProperties, ReactNode } from "react";
import { t } from "@/lib/i18n";
import { LABO_STATUS_CONFIG, type LaboStatus } from "@/features/labo/api/laboApi";
import type { LaboOrderFacts } from "./laboOrderFacts";

interface BlockProps {
  title: string;
  rows: [label: string, value: string][];
  children?: ReactNode;
}

/** One titled block of label/value rows, the modal's four quarters. */
function Block({ title, rows, children }: BlockProps) {
  return (
    <section className="pd-labo-detail-block">
      <h3>{title}</h3>
      <div className="pd-labo-detail-rows">
        {rows.map(([label, value]) => (
          <div className="pd-labo-detail-row" key={label}>
            <span>{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
      {children}
    </section>
  );
}

/** The status pill under the fourth block, in the same tone as the table's. */
function StatusPill({ status }: { status: LaboStatus }) {
  const tone = LABO_STATUS_CONFIG[status];
  return (
    <span
      className="pd-labo-detail-pill"
      style={{ "--pill-bg": tone.bg, "--pill-color": tone.color } as CSSProperties}
    >
      {t(tone.label)}
    </span>
  );
}

interface Props {
  facts: LaboOrderFacts;
  status: LaboStatus;
}

/**
 * The read-only body of "Thông tin chung": two columns of two blocks each,
 * measured on the reference (docs/clone/pages/patient-detail.md, Tab 6).
 */
export function LaboDetailFacts({ facts, status }: Props) {
  return (
    <div className="pd-labo-detail">
      <Block
        title={t("Patient:Form:GeneralInfo")}
        rows={[
          [t("Patient:QuoteSheet:PrescribingDoctor"), facts.dentist],
          [t("Patient:Col:Customer"), facts.customer],
          [t("Patient:Col:DateOfBirth"), facts.birthDate],
        ]}
      />
      <Block
        title={t("Patient:Labo:Info")}
        rows={[
          [t("Patient:Labo:Supplier"), facts.supplier],
          [t("Patient:Labo:SentDate"), facts.sentAt],
          [t("Patient:Labo:ExpectedReceiveDate"), facts.dueDate],
        ]}
      />
      <Block
        title={t("Patient:Labo:Params")}
        rows={[
          [t("Patient:Labo:Material"), facts.material],
          [t("Patient:Viewer:CompletedPath"), facts.finishLine],
          [t("Patient:DentalChart:Occlusion"), facts.bite],
          [t("Patient:DentalChart:RhythmType"), facts.rhythm],
          [t("Patient:QuoteSheet:Prescription"), facts.instruction],
        ]}
      />
      <Block
        title={t("Patient:Stage:SlipDetail")}
        rows={[
          [t("Patient:Plan:Service"), facts.treatmentService],
          [t("Patient:Labo:ProsthesisType"), facts.laboService],
          [t("Patient:DentalChart:Tooth"), facts.teeth],
          [t("Patient:Viewer:DetailColor"), facts.shade],
          [t("Patient:Payment:Quantity"), facts.quantity],
        ]}
      >
        <h3>{t("Patient:Misc:StatusLabel")}</h3>
        <StatusPill status={status} />
      </Block>
    </div>
  );
}
