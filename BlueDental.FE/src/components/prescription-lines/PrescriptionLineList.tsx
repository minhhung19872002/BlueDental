import { useMediaQuery } from "@/hooks/useMediaQuery";
import { PrescriptionLineCard } from "./PrescriptionLineCard";
import { PrescriptionLineTable } from "./PrescriptionLineTable";
import { EMPTY_PRESCRIPTION_LINE, type MedicineOption, type PrescriptionLine } from "./types";
import "./prescription-lines.css";

/** Below this the table gives way to one card per line; matches the stylesheet. */
const NARROW_SCREEN = "(max-width: 640px)";

interface Props {
  lines: PrescriptionLine[];
  medicines: MedicineOption[];
  onChange: (next: PrescriptionLine[]) => void;
}

/** The lines with a blank one appended — one in the morning for one day. */
export function appendEmptyLine(lines: PrescriptionLine[]): PrescriptionLine[] {
  return [...lines, { ...EMPTY_PRESCRIPTION_LINE }];
}

/**
 * The medicine lines the Đơn thuốc mẫu catalog and the patient's Đơn thuốc
 * both edit: a table on a wide screen, one card per line on a narrow one —
 * one or the other, never both. The caller owns the buttons above it.
 */
export function PrescriptionLineList({ lines, medicines, onChange }: Props) {
  const narrow = useMediaQuery(NARROW_SCREEN);

  // Rows are patched by identity: two new lines are otherwise indistinguishable.
  const patch = (target: PrescriptionLine, change: Partial<PrescriptionLine>) =>
    onChange(lines.map((line) => (line === target ? { ...line, ...change } : line)));
  const remove = (target: PrescriptionLine) => onChange(lines.filter((line) => line !== target));

  if (!narrow) {
    return (
      <PrescriptionLineTable lines={lines} medicines={medicines} onPatch={patch} onRemove={remove} />
    );
  }

  return (
    <div className="bd-rx-cards">
      {lines.map((line, index) => (
        <PrescriptionLineCard
          key={line.id ?? `new-${index}`}
          line={line}
          index={index}
          medicines={medicines}
          canDelete={lines.length > 1}
          onPatch={(change) => patch(line, change)}
          onDelete={() => remove(line)}
        />
      ))}
    </div>
  );
}
