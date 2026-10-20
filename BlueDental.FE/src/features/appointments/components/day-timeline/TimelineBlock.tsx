import React, { useCallback, useMemo } from "react";
import { Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { buildAppointmentCardMenu, isFinishedSeriesSession } from "../appointmentCardMenu";
import { BLOCK_STATE_LABEL_KEY, type BlockState } from "./blockState";
import type { PlacedBlock } from "./timelineLayout";

interface Props {
  placed: PlacedBlock;
  state: BlockState;
  selected?: boolean;
  onAction?: (action: string, id: string) => void;
}

function blockName(placed: PlacedBlock): string {
  return placed.appointment.patientName?.trim() || t("Common:Appointment");
}

function blockTitle(placed: PlacedBlock): string {
  const { patientCode } = placed.appointment;
  return patientCode ? `[${patientCode}] ${blockName(placed)}` : blockName(placed);
}

/* Mirrors `.dtl-block` in calendar.css: 2px under the slot, 22px at least, 6px of border and padding, 16px lines. */
const BLOCK_GAP_PX = 2;
const BLOCK_MIN_PX = 22;
const BLOCK_CHROME_PX = 6;
const LINE_PX = 16;

/** Lines of "Nội dung đặt lịch" that fit under the name; 0 when the block only holds the name. */
function noteLineCount(height: number): number {
  const inner = Math.max(height - BLOCK_GAP_PX, BLOCK_MIN_PX) - BLOCK_CHROME_PX;
  return Math.max(Math.floor(inner / LINE_PX) - 1, 0);
}

function BlockTooltip({ placed, state }: Pick<Props, "placed" | "state">) {
  const { startTime, endTime, reason } = placed.appointment;
  return (
    <div className="dtl-tip">
      <div className="dtl-tip-title">{blockTitle(placed)}</div>
      <div>{`${dayjs(startTime).format("HH:mm")} - ${dayjs(endTime).format("HH:mm")}`}</div>
      {reason && <div className="dtl-tip-note">{reason}</div>}
      <div className="dtl-tip-state">{t(BLOCK_STATE_LABEL_KEY[state])}</div>
    </div>
  );
}

/** One booking on a doctor's row: click opens it, ⋮ offers the card menu. */
export const TimelineBlock = React.memo(function TimelineBlock({ placed, state, selected, onAction }: Props) {
  const id = placed.appointment.id;
  const note = placed.appointment.reason?.trim();
  const noteLines = note ? noteLineCount(placed.height) : 0;
  const undeletable = isFinishedSeriesSession(placed.appointment);
  const menuItems = useMemo(() => buildAppointmentCardMenu(selected, undeletable), [selected, undeletable]);

  const handleOpen = useCallback(() => onAction?.("edit", id), [onAction, id]);
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onAction?.("edit", id);
  }, [onAction, id]);
  const handleMenuClick = useCallback<NonNullable<MenuProps["onClick"]>>((info) => {
    info.domEvent.stopPropagation();
    onAction?.(info.key, id);
  }, [onAction, id]);

  const className = ["dtl-block", `dtl-block--${state}`, selected && "dtl-block--selected"]
    .filter(Boolean)
    .join(" ");

  return (
    <Tooltip title={<BlockTooltip placed={placed} state={state} />} mouseEnterDelay={0.4} placement="top">
      <div
        className={className}
        role="button"
        tabIndex={0}
        aria-label={blockTitle(placed)}
        style={{
          "--dtl-block-top": `${placed.top}px`,
          "--dtl-block-height": `${placed.height}px`,
          "--dtl-block-lane": placed.lane,
          "--dtl-note-lines": noteLines,
        } as React.CSSProperties}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
      >
        {/* A 15-minute block is one line tall: the name alone fits, the code rides in the tooltip. */}
        <span className="dtl-block-label">{blockName(placed)}</span>
        {/* BA 2026-10-20: the booking's content under the name, cut with "…" where the block ends. */}
        {noteLines > 0 && <span className="dtl-block-note">{note}</span>}
        <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }} trigger={["click"]} placement="bottomRight">
          <button
            type="button"
            className="dtl-block-menu"
            aria-label={t("Appointment:EventCard:AddAria")}
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </Dropdown>
      </div>
    </Tooltip>
  );
});
