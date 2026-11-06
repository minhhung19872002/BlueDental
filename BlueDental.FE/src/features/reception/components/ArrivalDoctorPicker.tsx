import React, { useEffect, useRef, useState } from "react";
import { Checkbox, Input, Spin, Tooltip } from "antd";
import { Eye, Search } from "lucide-react";
import { StaffLabelBadge } from "@/components/LabelColor";
import { t } from "@/lib/i18n";
import { matchesSearch } from "@/utils/foldForSearch";
import type { ArrivalDoctor, ArrivalDoctorPick } from "../types/arrivalCall";

const TOGGLE_CLASS = "arrival-doctor-pick-button";

const isPicked = (pick: ArrivalDoctorPick, id: string) => pick.all || pick.doctorIds.includes(id);

/** Ticking the last unticked doctor reads as "Tất cả": a doctor added later shows too. */
function toggleDoctor(pick: ArrivalDoctorPick, doctors: ArrivalDoctor[], id: string): ArrivalDoctorPick {
  const current = pick.all ? doctors.map((d) => d.id) : pick.doctorIds;
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  const coversAll = doctors.length > 0 && doctors.every((d) => next.includes(d.id));
  return coversAll ? { all: true } : { all: false, doctorIds: next };
}

// In the dock, not on <body>: a click outside the dock folds the panel away.
const tooltipInDock = (trigger: HTMLElement) => trigger.closest<HTMLElement>(".arrival-dock") ?? document.body;

interface ArrivalDoctorPickToggleProps {
  open: boolean;
  onToggle: () => void;
}

/** The 👁 on the "Khách đã đến" title bar: opens or closes the doctor popover (R-1164). */
export const ArrivalDoctorPickToggle: React.FC<ArrivalDoctorPickToggleProps> = ({ open, onToggle }) => (
  <Tooltip title={t("Reception:ArrivalDoctorPick")} getPopupContainer={tooltipInDock} open={open ? false : undefined}>
    <button
      type="button"
      className={[TOGGLE_CLASS, open && `${TOGGLE_CLASS}--open`].filter(Boolean).join(" ")}
      aria-label={t("Reception:ArrivalDoctorPick")}
      aria-expanded={open}
      onClick={onToggle}
    >
      <Eye size={18} aria-hidden />
    </button>
  </Tooltip>
);

/** A click anywhere but the popover or its 👁, or Escape, folds it away. */
function useDismiss(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (ref.current?.contains(event.target) || event.target.closest(`.${TOGGLE_CLASS}`)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ref, onClose]);
}

interface ArrivalDoctorPickPopoverProps {
  doctors: ArrivalDoctor[];
  loading: boolean;
  pick: ArrivalDoctorPick;
  onPickChange: (pick: ArrivalDoctorPick) => void;
  onClose: () => void;
}

/**
 * Opened with the 👁 (R-1164, BA 2026-11-06): ticks whose arrived patients
 * "Khách đã đến" shows — several doctors, every doctor, or none.
 *
 * A popover beside the panel, placed by CSS rather than AntD's Popover: a
 * fixed height, so searching never moves it, and pinned to the panel's top
 * or, on a short panel, its bottom, so it never runs off the screen. The rows
 * stay in sight and follow each tick.
 */
export const ArrivalDoctorPickPopover: React.FC<ArrivalDoctorPickPopoverProps> = ({
  doctors,
  loading,
  pick,
  onPickChange,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  useDismiss(ref, onClose);

  const shown = doctors.filter((d) => matchesSearch(d.name, query));
  const pickedCount = doctors.filter((d) => isPicked(pick, d.id)).length;
  const allPicked = pick.all || (doctors.length > 0 && pickedCount === doctors.length);

  const handleAllChange = () => onPickChange(allPicked ? { all: false, doctorIds: [] } : { all: true });

  return (
    <div ref={ref} className="arrival-doctor-pick" role="dialog" aria-label={t("Reception:ArrivalDoctorPick")}>
      <div className="arrival-doctor-pick-title">{t("Reception:ArrivalDoctorPick")}</div>
      <Input
        size="small"
        allowClear
        prefix={<Search size={14} aria-hidden />}
        placeholder={t("Reception:ArrivalDoctorPickSearch")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Checkbox
        className="arrival-doctor-pick-all"
        checked={allPicked}
        indeterminate={!allPicked && pickedCount > 0}
        onChange={handleAllChange}
      >
        {t("Reception:ArrivalDoctorPickAll")}
      </Checkbox>
      <ul className="arrival-doctor-pick-list">
        {loading && (
          <li className="arrival-doctor-pick-empty">
            <Spin size="small" />
          </li>
        )}
        {!loading && shown.length === 0 && (
          <li className="arrival-doctor-pick-empty">{t("Reception:ArrivalDoctorPickNoDoctors")}</li>
        )}
        {shown.map((doctor) => (
          <li key={doctor.id}>
            <Checkbox
              checked={isPicked(pick, doctor.id)}
              onChange={() => onPickChange(toggleDoctor(pick, doctors, doctor.id))}
            >
              <StaffLabelBadge color={doctor.labelColor}>{doctor.name}</StaffLabelBadge>
            </Checkbox>
          </li>
        ))}
      </ul>
    </div>
  );
};
