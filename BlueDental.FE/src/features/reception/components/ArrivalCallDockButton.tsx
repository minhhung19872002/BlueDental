import React from "react";
import { Tooltip } from "antd";
import { BellOff, Users } from "lucide-react";
import { t } from "@/lib/i18n";

interface ArrivalCallDockButtonProps {
  open: boolean;
  badgeCount: number;
  /** The page has had no click yet, so the browser keeps the chime silent. */
  soundOff: boolean;
  /** A chime was blocked and its patient still waits: the button blinks. */
  missedChime: boolean;
  onToggle: () => void;
}

/**
 * The dock's round button: the badge counts the patients waiting for the
 * viewer; a muted bell and its tooltip ask for one click to turn the chime on
 * (R-1145), and the click itself is that click.
 */
export const ArrivalCallDockButton: React.FC<ArrivalCallDockButtonProps> = ({
  open,
  badgeCount,
  soundOff,
  missedChime,
  onToggle,
}) => {
  const soundOffHint = t("Reception:ArrivalCallSoundOff");
  const className = [
    "arrival-dock-button",
    open && "arrival-dock-button--open",
    missedChime && !open && "arrival-dock-button--missed",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tooltip title={soundOff ? soundOffHint : undefined} placement="left">
      <button
        type="button"
        className={className}
        aria-label={t("Reception:ArrivalCallOpen")}
        aria-expanded={open}
        onClick={onToggle}
      >
        <Users size={26} aria-hidden />
        {badgeCount > 0 && <span className="arrival-dock-badge">{badgeCount > 99 ? "99+" : badgeCount}</span>}
        {soundOff && (
          <span className="arrival-dock-mute" role="img" aria-label={soundOffHint}>
            <BellOff size={13} aria-hidden />
          </span>
        )}
      </button>
    </Tooltip>
  );
};
