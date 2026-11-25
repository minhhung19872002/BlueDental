import { usageLabel } from "@/components/prescription-lines";
import { t } from "@/lib/i18n";
import type { PrescriptionItemDto } from "../../api/prescriptionApi";

/** What a fact shows with no value: a dash, a dotted line to write on, or nothing. */
type EmptyFact = "dash" | "dots" | "blank";

interface FactProps {
  label: string;
  value: string;
  /** Spans both columns. */
  wide?: boolean;
  empty?: EmptyFact;
  /** With `empty="dots"`: how many lines to write on — the rest of the label's, then whole ones (R-1317). */
  dotLines?: number;
}

/** "Họ tên: NGUYỄN VĂN A" — one fact of the ĐƠN THUỐC's patient block. */
export function RxSheetFact({ label, value, wide, empty = "dash", dotLines = 1 }: FactProps) {
  const dotted = !value && empty === "dots";
  const className = ["rx-sheet-fact", wide && "rx-sheet-fact--wide", dotted && "rx-sheet-fact--dots"]
    .filter(Boolean)
    .join(" ");
  if (dotted) {
    return (
      <p className={className}>
        <span>{label}:</span>
        {Array.from({ length: dotLines }, (_, line) => (
          <span key={line} className="rx-sheet-dots" aria-hidden />
        ))}
      </p>
    );
  }
  return (
    <p className={className}>
      <span>{label}:</span> {value ? <strong>{value}</strong> : empty === "dash" && <strong>—</strong>}
    </p>
  );
}

/**
 * "Uống – Sau khi ăn": the medicine's Cách dùng in the catalog, then how the
 * slip says to take it, each left out when empty (R-1313). The doses are not
 * printed (R-1302).
 */
function usageOf(item: PrescriptionItemDto): string {
  const slipUsage = item.usage === 0 ? "" : usageLabel(item);
  return [item.medicineUsage, slipUsage].filter(Boolean).join(" – ");
}

/** "(Không dùng cho phụ nữ có thai)" — the catalog's Lưu ý sử dụng, or nothing. */
function noteOf(item: PrescriptionItemDto): string {
  return item.medicineUsageNote ? `(${item.medicineUsageNote})` : "";
}

/**
 * The medicines as the BA's third Word copy (R-1302): a numbered list with no
 * rules or header, each name bold over how to take it in italics and a third
 * line holding the catalog's Lưu ý sử dụng in smaller italics, blank when none
 * (R-1313); then the quantity and the medicine's Đơn vị tính in the catalog —
 * left empty when the catalog has none.
 */
export function RxSheetMedicines({ items }: { items: PrescriptionItemDto[] }) {
  return (
    <ol className="rx-sheet-meds">
      {items.map((item) => (
        <li key={item.id} className="rx-sheet-med">
          <p className="rx-sheet-med-text">
            <strong>{item.medicationName}</strong>
            <em>{usageOf(item)}</em>
            <span className="rx-sheet-med-note">{noteOf(item)}</span>
          </p>
          <span className="rx-sheet-qty">{item.quantity}</span>
          <span className="rx-sheet-unit">{item.unit ?? ""}</span>
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
