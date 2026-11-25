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
