import type { ReactNode } from "react";
import { LabelBadge } from "./LabelBadge";
import { STAFF_LABEL_COLOR_DEFAULT } from "./labelColor";

interface StaffLabelBadgeProps {
  /** The staff member's "Màu nhãn"; null or absent draws the staff default. */
  color?: string | null;
  children: ReactNode;
  title?: string;
}

/** A staff member's name worn in their "Màu nhãn" (R-1155). */
export function StaffLabelBadge({ color, children, title }: StaffLabelBadgeProps) {
  return (
    <LabelBadge color={color || STAFF_LABEL_COLOR_DEFAULT} title={title}>
      {children}
    </LabelBadge>
  );
}
