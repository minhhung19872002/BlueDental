import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { isLightColor } from "./labelColor";
import "./label-color.css";

interface LabelBadgeProps {
  /** "#RRGGBB"; null or absent draws the default grey. */
  color?: string | null;
  children: ReactNode;
  /** Full text on hover, for a badge its column cuts short. */
  title?: string;
}

/**
 * A name worn as a solid badge in its record's chosen colour, white text — or
 * dark text when the colour is too pale to carry white (R-1072).
 */
export function LabelBadge({ color, children, title }: LabelBadgeProps) {
  return (
    <span
      className={cn("bd-label-badge", color && isLightColor(color) && "bd-label-badge--light")}
      style={color ? ({ "--bd-label-color": color } as CSSProperties) : undefined}
      title={title}
    >
      {children}
    </span>
  );
}
