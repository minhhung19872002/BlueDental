import { useMemo } from "react";
import { Tooltip } from "antd";
import { usePatientTagOptions } from "@/hooks/usePatientTagOptions";
import { PatientTagChip } from "./PatientTagChip";
import "./patient-tag-picker.css";

interface PatientTagStripProps {
  branchId: string;
  tagIds: readonly string[];
  /** Chips drawn before the rest fold into "+N". */
  max?: number;
}

/**
 * A record's tags on a row too narrow for all of them: the first `max` chips,
 * then a "+N" chip whose tooltip names every tag. Catalog order, like the
 * record's own header, so a chip does not move when a tag is put back.
 */
export function PatientTagStrip({ branchId, tagIds, max = 2 }: PatientTagStripProps) {
  const options = usePatientTagOptions(branchId).data;
  const onRecord = useMemo(
    () => (options ?? []).filter((tag) => tagIds.includes(tag.value)),
    [options, tagIds],
  );
  if (onRecord.length === 0) return null;

  const shown = onRecord.slice(0, max);
  const hidden = onRecord.length - shown.length;
  return (
    <span className="pd-tag-strip">
      {shown.map((tag) => (
        <PatientTagChip key={tag.value} color={tag.color} label={tag.label} title={tag.label} />
      ))}
      {hidden > 0 ? (
        <Tooltip
          title={
            <span className="pd-tag-strip-tooltip">
              {onRecord.map((tag) => (
                <span key={tag.value}>{tag.label}</span>
              ))}
            </span>
          }
        >
          <span className="pd-tag-chip pd-tag-more">+{hidden}</span>
        </Tooltip>
      ) : null}
    </span>
  );
}
