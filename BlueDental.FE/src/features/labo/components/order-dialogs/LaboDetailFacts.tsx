import type { CSSProperties, ReactNode } from "react";
import { t } from "@/lib/i18n";
import type { LaboPill } from "@/features/labo/api/laboStatus";
import type { LaboOrderFacts } from "./laboOrderFacts";

interface BlockProps {
  title: string;
  rows: [label: string, value: string][];
  children?: ReactNode;
}

/** One titled block of label/value rows, the modal's four quarters. */
export function Block({ title, rows, children }: BlockProps) {
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

/** Ghi chú cho Labo, shown only on an older order that carries one (R-1150 dropped it). */
const noteRow = (note: string): [label: string, value: string][] => (note ? [[t("Labo:Spec:Note"), note]] : []);

/** The status pill under the fourth block, in the same tone as the table's. */
export function StatusPill({ tone }: { tone: LaboPill }) {
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
  /** The order's status pill — the stored status, or Hết hạn bảo hành. */
  pill: LaboPill;
}

/**
 * The read-only body of "Thông tin chung": two columns of two blocks each,
 * measured on the reference (docs/clone/pages/patient-detail.md, Tab 6).
 */
export function LaboDetailFacts({ facts, pill }: Props) {
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
          [t("Patient:Labo:ExpectedReceiveDate"), facts.dueAt],
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
          [t("Common:Note"), facts.note],
        ]}
      />
      <Block
        title={t("Patient:Stage:SlipDetail")}
        rows={[
          [t("Patient:Plan:Service"), facts.treatmentService],
          [t("Patient:Labo:ProsthesisType"), facts.laboService],
          [t("Patient:DentalChart:Tooth"), facts.teeth],
          [t("Labo:Spec:Surfaces"), facts.surfaces],
          [t("Patient:Viewer:DetailColor"), facts.shade],
          ...noteRow(facts.labNote),
          [t("Patient:Payment:Quantity"), facts.quantity],
        ]}
      >
        <h3>{t("Patient:Misc:StatusLabel")}</h3>
        <StatusPill tone={pill} />
      </Block>
    </div>
  );
}
