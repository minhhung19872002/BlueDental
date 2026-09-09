import { useRef, useState, type ReactElement, type ReactNode } from "react";
import { Tooltip } from "antd";

interface Props {
  title: string;
  children: ReactElement;
}

/**
 * The hint on a row action, dismissed the moment the action is taken.
 *
 * An Ant Design tooltip left open over a button that has just opened a dialog
 * keeps listening for Escape and closes itself with it, so the first Escape
 * never reaches the dialog and the user has to press it twice. Pressing the
 * button hides the tip and holds it shut, because the pointer is still on the
 * trigger and the tooltip would otherwise ask to reopen straight away; the
 * hold lifts when the pointer leaves.
 *
 * The tip hangs off a plain span rather than the button so the wrapper can
 * carry those handlers without touching what it wraps.
 */
export function ActionTooltip({ title, children }: Props): ReactNode {
  const [open, setOpen] = useState(false);
  const held = useRef(false);

  return (
    <Tooltip
      title={title}
      open={open}
      onOpenChange={(next) => {
        if (next && held.current) return;
        setOpen(next);
      }}
    >
      <span
        className="tp-tip"
        // Capture, and on the way down: the tip has to be gone before the
        // button's own click puts a dialog on screen.
        onPointerDownCapture={() => {
          held.current = true;
          setOpen(false);
        }}
        onPointerLeave={() => {
          held.current = false;
        }}
      >
        {children}
      </span>
    </Tooltip>
  );
}
