import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import type { HistoryEntry } from "../../types/appointmentHistory";
import { AppointmentStarIcon, isAppointmentStar } from "../AppointmentStar";
import { appointmentColorLabel } from "./legacyColorLabel";
import { fieldLabel, formatFieldValue, tableChanges } from "./historyLabels";

const EMPTY = "—";

interface Props {
  entry: HistoryEntry;
  side: "before" | "after";
}

/** A stored value as a person reads it: a star as the star itself, an old appointment colour as a dot, the rest as text. */
export function HistoryFieldValue({ field, value }: { field: string; value: string | null }) {
  if (field === "star" && isAppointmentStar(value)) {
    return <AppointmentStarIcon star={value} />;
  }
  if (field === "color" && value) {
    const name = appointmentColorLabel(value) ?? value;
    return (
      <span
        role="img"
        aria-label={name}
        title={name}
        className="ah-color-swatch"
        style={{ "--ah-swatch": value } as CSSProperties}
      />
    );
  }
  return <>{formatFieldValue(field, value)}</>;
}

/**
 * One side of a change for the table's "Giá trị cũ" / "Giá trị mới" columns:
 * a "Field: value" line per field, in the same order on both sides so the two
 * cells read across. A side with no appointment at all (before a creation,
 * after a deletion) is a single dash rather than a dash per field.
 */
export function HistoryValueList({ entry, side }: Props) {
  const changes = tableChanges(entry);
  const snapshot = side === "before" ? entry.before : entry.after;
  const className = cn("ah-values", `ah-values--${side}`);

  if (!snapshot || changes.length === 0) {
    return <span className={className}>{EMPTY}</span>;
  }

  return (
    <ul className={className}>
      {changes.map((change) => (
        <li key={change.field} className="ah-value">
          <span className="ah-value-field">{fieldLabel(change.field)}:</span>{" "}
          <span className="ah-value-text">
            <HistoryFieldValue field={change.field} value={change[side]} />
          </span>
        </li>
      ))}
    </ul>
  );
}
