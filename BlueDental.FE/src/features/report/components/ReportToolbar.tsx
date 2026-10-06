import { useMemo } from "react";
import { Button, Segmented } from "antd";
import type { Dayjs } from "dayjs";
import { DateNavigator } from "@/components/DateNavigator";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { useStaffList } from "@/features/staff/api/staffQueries";
import { STAFF_ROLE } from "@/hooks/useStaffOptions";
import { REPORT_VIEW_MODES, type ReportViewMode } from "../types/viewMode";

const VIEW_MODE_LABELS: Record<ReportViewMode, () => string> = {
  day: () => t("Report:Period:Day"),
  week: () => t("Report:Period:Week"),
  month: () => t("Report:Period:Month"),
  year: () => t("Report:Period:Year"),
};

interface Props {
  viewMode: ReportViewMode;
  currentDate: Dayjs;
  doctorId?: string;
  showDoctor: boolean;
  /** Tab 4 on the reference: the mode pills stay, the navigator becomes a disabled "Tổng". */
  periodLocked?: boolean;
  onViewModeChange: (mode: ReportViewMode) => void;
  onDateChange: (date: Dayjs) => void;
  onDoctorChange: (id?: string) => void;
}

/** Period switcher + date navigator on the left, doctor filter on the right. */
export function ReportToolbar({
  viewMode,
  currentDate,
  doctorId,
  showDoctor,
  periodLocked = false,
  onViewModeChange,
  onDateChange,
  onDoctorChange,
}: Props) {
  // Bác sĩ filter: staff ticked "Bác sĩ", filtered on the server so a clinic
  // past one page still lists every doctor.
  const { data: staffResult } = useStaffList({ isActive: true, maxResultCount: 1000, role: STAFF_ROLE.Dentist });
  const doctorOptions = useMemo(
    () => (staffResult?.items ?? []).map((d) => ({ value: d.id, label: d.fullName })),
    [staffResult],
  );

  const segmentedOptions = REPORT_VIEW_MODES.map((m) => ({ value: m, label: VIEW_MODE_LABELS[m]() }));
  return (
    <div className="report-toolbar">
      <Segmented
        className="report-segmented report-toolbar-modes"
        value={viewMode}
        options={segmentedOptions}
        onChange={(val) => onViewModeChange(val as ReportViewMode)}
      />

      {periodLocked ? (
        <Button disabled className="report-toolbar-date report-toolbar-total">
          {t("Report:Period:Total")}
        </Button>
      ) : (
        <DateNavigator
          className="report-toolbar-date"
          value={currentDate}
          mode={viewMode}
          onChange={onDateChange}
        />
      )}

      {showDoctor && (
        <div className="report-toolbar-doctor">
          <SearchSelect
            value={doctorId}
            placeholder={t("Report:Toolbar:DoctorFilter")}
            allowClear
            options={doctorOptions}
            onChange={onDoctorChange}
          />
        </div>
      )}
    </div>
  );
}
