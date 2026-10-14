import { useState, type MouseEvent } from "react";
import { Tooltip } from "antd";
import { cn } from "@/lib/cn";

interface Props {
  text: string;
  className?: string;
}

/**
 * One line of text cut with "…" when it does not fit, and the whole of it in a
 * tooltip on hover — only when it was actually cut, so a short name does not
 * repeat itself in a bubble. Whether it was cut is measured as the pointer
 * arrives, so it holds at any width the panel is dragged or folded to.
 */
export function TruncatedText({ text, className }: Props) {
  const [cut, setCut] = useState(false);

  const handleMouseEnter = (event: MouseEvent<HTMLSpanElement>) => {
    const element = event.currentTarget;
    setCut(element.scrollWidth > element.clientWidth);
  };

  return (
    <Tooltip title={cut ? text : undefined} placement="right" mouseEnterDelay={0.3}>
      <span className={cn("bd-truncate", className)} onMouseEnter={handleMouseEnter}>
        {text}
      </span>
    </Tooltip>
  );
}
