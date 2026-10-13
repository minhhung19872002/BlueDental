import React from "react";
import { SearchSelect, RankedMultiSearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { ReceptionDoctor } from "../api/receptionQueries";
import type { DoctorFilter } from "../hooks/useDoctorFilter";
import type { ReceptionDoctorTeam } from "../types/reception";

interface ReceptionDoctorFiltersProps {
  filter: DoctorFilter;
  teams: ReceptionDoctorTeam[];
  doctors: ReceptionDoctor[];
  /** "stacked": a label above each, for the mobile filter drawer. */
  layout: "inline" | "stacked";
}

/** Nhóm bác sĩ and Bác sĩ — the board's two doctor filters, one at a time. */
export const ReceptionDoctorFilters: React.FC<ReceptionDoctorFiltersProps> = ({ filter, teams, doctors, layout }) => {
  const teamSelect = (
    <SearchSelect
      value={filter.teamId}
      placeholder={t("Reception:DoctorTeam")}
      allowClear
      emptyText={t("Reception:NoDoctorTeams")}
      options={teams.map((team) => ({ value: team.id, label: team.name }))}
      onChange={filter.selectTeam}
    />
  );
  const doctorSelect = (
    <RankedMultiSearchSelect
      value={filter.doctorIds}
      placeholder={t("Reception:Doctor")}
      rankHint={t("Common:PriorityFromStaff")}
      options={doctors.map((d) => ({ value: d.id, label: d.name }))}
      onChange={filter.selectDoctors}
    />
  );

  if (layout === "stacked") {
    return (
      <>
        <div>
          <div className="mobile-filter-label">{t("Reception:DoctorTeam")}</div>
          {teamSelect}
        </div>
        <div>
          <div className="mobile-filter-label">{t("Reception:Doctor")}</div>
          {doctorSelect}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="reception-team-filter">{teamSelect}</div>
      <div className="reception-doctor-filter">{doctorSelect}</div>
    </>
  );
};
