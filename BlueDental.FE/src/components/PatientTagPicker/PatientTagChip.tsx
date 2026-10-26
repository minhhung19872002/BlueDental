import type { CSSProperties } from "react";
import { TagsOutlined } from "@ant-design/icons";

interface PatientTagChipProps {
  color: string;
  label: string;
  /** Full name on hover, for a chip its row cuts short. */
  title?: string;
}

/**
 * A Thẻ hồ sơ as the reference draws it: the tag's own colour, white bold text
 * and a tag glyph. The same chip appears in the picker and beside the name, so
 * it carries a class of its own — as a bare `<span>` it also matched the
 * picker row's chip rule, which painted the ✓ beside it white on white.
 */
export function PatientTagChip({ color, label, title }: PatientTagChipProps) {
  return (
    <span className="pd-tag-chip" title={title} style={{ "--pd-tag-color": color } as CSSProperties}>
      <TagsOutlined /> {label}
    </span>
  );
}
