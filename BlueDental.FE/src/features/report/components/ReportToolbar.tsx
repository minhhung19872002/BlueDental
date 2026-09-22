import { useMemo } from "react";
import { Button, Segmented } from "antd";
import type { Dayjs } from "dayjs";
import { DateNavigator } from "@/components/DateNavigator";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { useStaffList } from "@/features/staff/api/staffQueries";
import { REPORT_VIEW_MODES, type ReportViewMode } from "../types/viewMode";

const VIEW_MODE_LABELS: Record<ReportViewMode, () => string> = {
  day: () => t("Ngày"),
  week: () => t("Tuần"),
  month: () => t("Tháng"),
  year: () => t("Năm"),
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
  const { data: staffResult } = useStaffList({ isActive: true, maxResultCount: 200 });
  const doctorOptions = useMemo(
    () => (staffResult?.items ?? []).filter((d) => d.isDentist).map((d) => ({ value: d.id, label: d.fullName })),
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
          {t("Tổng")}
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
            placeholder={t("Bác sĩ điều trị")}
            allowClear
            options={doctorOptions}
            onChange={onDoctorChange}
          />
        </div>
      )}
    </div>
  );
}
