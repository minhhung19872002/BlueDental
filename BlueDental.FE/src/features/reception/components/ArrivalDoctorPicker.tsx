import React, { useState } from "react";
import { Checkbox, Input, Spin, Tooltip } from "antd";
import { Eye, Search } from "lucide-react";
import { StaffLabelBadge } from "@/components/LabelColor";
import { t } from "@/lib/i18n";
import { matchesSearch } from "@/utils/foldForSearch";
import type { ArrivalDoctor, ArrivalDoctorPick } from "../types/arrivalCall";

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

/** The 👁 on the "Khách đã đến" title bar: shows or hides the doctor list (R-1164). */
export const ArrivalDoctorPickToggle: React.FC<ArrivalDoctorPickToggleProps> = ({ open, onToggle }) => (
  <Tooltip title={t("Reception:ArrivalDoctorPick")} getPopupContainer={tooltipInDock}>
    <button
      type="button"
      className={["arrival-doctor-pick-button", open && "arrival-doctor-pick-button--open"].filter(Boolean).join(" ")}
      aria-label={t("Reception:ArrivalDoctorPick")}
      aria-expanded={open}
      onClick={onToggle}
    >
      <Eye size={18} aria-hidden />
    </button>
  </Tooltip>
);

interface ArrivalDoctorPickListProps {
  doctors: ArrivalDoctor[];
  loading: boolean;
  pick: ArrivalDoctorPick;
  onPickChange: (pick: ArrivalDoctorPick) => void;
}

/**
 * Under the "Khách đã đến" title, opened with the 👁 (R-1164, BA 2026-11-06):
 * ticks whose arrived patients the list shows — several doctors, every
 * doctor, or none. In the panel, not floating: the rows below follow each tick.
 */
export const ArrivalDoctorPickList: React.FC<ArrivalDoctorPickListProps> = ({ doctors, loading, pick, onPickChange }) => {
  const [query, setQuery] = useState("");
  const shown = doctors.filter((d) => matchesSearch(d.name, query));
  const pickedCount = doctors.filter((d) => isPicked(pick, d.id)).length;
  const allPicked = pick.all || (doctors.length > 0 && pickedCount === doctors.length);

  const handleAllChange = () => onPickChange(allPicked ? { all: false, doctorIds: [] } : { all: true });

  return (
    <div className="arrival-doctor-pick" role="group" aria-label={t("Reception:ArrivalDoctorPick")}>
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
      {loading && <Spin size="small" />}
      {!loading && shown.length === 0 && (
        <div className="arrival-doctor-pick-empty">{t("Reception:ArrivalDoctorPickNoDoctors")}</div>
      )}
      <ul className="arrival-doctor-pick-list">
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
