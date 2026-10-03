import React, { useCallback, useMemo } from "react";
import { Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { buildAppointmentCardMenu } from "../appointmentCardMenu";
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

function BlockTooltip({ placed, state }: Pick<Props, "placed" | "state">) {
  const { startTime, endTime, reason } = placed.appointment;
  return (
    <div className="dtl-tip">
      <div className="dtl-tip-title">{blockTitle(placed)}</div>
      <div>{`${dayjs(startTime).format("HH:mm")} - ${dayjs(endTime).format("HH:mm")}`}</div>
      {reason && <div>{reason}</div>}
      <div className="dtl-tip-state">{t(BLOCK_STATE_LABEL_KEY[state])}</div>
    </div>
  );
}

/** One booking on a doctor's row: click opens it, ⋮ offers the card menu. */
export const TimelineBlock = React.memo(function TimelineBlock({ placed, state, selected, onAction }: Props) {
  const id = placed.appointment.id;
  const menuItems = useMemo(() => buildAppointmentCardMenu(selected), [selected]);

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
          "--dtl-block-left": `${placed.left}px`,
          "--dtl-block-width": `${placed.width}px`,
          "--dtl-block-lane": placed.lane,
        } as React.CSSProperties}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
      >
        {/* A 15-minute block is ~76px wide: the name alone fits, the code rides in the tooltip. */}
        <span className="dtl-block-label">{blockName(placed)}</span>
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
