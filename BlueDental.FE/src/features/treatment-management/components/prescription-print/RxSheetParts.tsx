import { usageLabel } from "@/components/prescription-lines";
import { t } from "@/lib/i18n";
import type { PrescriptionItemDto } from "../../api/prescriptionApi";
import { doseText } from "../../utils/rxDose";

/** What a fact shows with no value: a dash, a dotted line to write on, or nothing. */
type EmptyFact = "dash" | "dots" | "blank";

interface FactProps {
  label: string;
  value: string;
  /** Spans both columns. */
  wide?: boolean;
  empty?: EmptyFact;
}

/** "Họ tên: NGUYỄN VĂN A" — one fact of the ĐƠN THUỐC's patient block. */
export function RxSheetFact({ label, value, wide, empty = "dash" }: FactProps) {
  const className = ["rx-sheet-fact", wide && "rx-sheet-fact--wide", !value && empty === "dots" && "rx-sheet-fact--dots"]
    .filter(Boolean)
    .join(" ");
  return (
    <p className={className}>
      <span>{label}:</span> {value ? <strong>{value}</strong> : <EmptyValue empty={empty} />}
    </p>
  );
}

function EmptyValue({ empty }: { empty: EmptyFact }) {
  if (empty === "dots") return <span className="rx-sheet-dots" aria-hidden />;
  if (empty === "blank") return null;
  return <strong>—</strong>;
}

/** "Sáng 1 · Tối 1 · 5 ngày · Sau khi ăn". */
function directionsOf(item: PrescriptionItemDto): string {
  const dose = doseText(item);
  const usage = item.usage === 0 ? null : usageLabel(item);
  return usage ? `${dose} · ${usage}` : dose;
}

/**
 * The medicines as the BA's second Word copy (R-1300): a numbered list with
 * no rules or header, each name bold over its directions in italics, the
 * quantity centred on the right.
 */
export function RxSheetMedicines({ items }: { items: PrescriptionItemDto[] }) {
  return (
    <ol className="rx-sheet-meds">
      {items.map((item) => (
        <li key={item.id} className="rx-sheet-med">
          <p className="rx-sheet-med-text">
            <strong>{item.medicationName}</strong>
            <em>{directionsOf(item)}</em>
          </p>
          <span className="rx-sheet-qty">{item.quantity}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * "Khác ……": the doctor's own advice when the slip carries one, a dotted line
 * to write it by hand when not.
 */
export function RxSheetOtherAdvice({ note }: { note: string | null }) {
  const text = note?.trim();
  if (text) {
    return (
      <p className="rx-sheet-other rx-sheet-note">
        {t("Treatment:RxPrint:Other")}: {text}
      </p>
    );
  }
  return (
    <p className="rx-sheet-other rx-sheet-other--dots">
      {t("Treatment:RxPrint:Other")}
      <span className="rx-sheet-dots" aria-hidden />
    </p>
  );
}
