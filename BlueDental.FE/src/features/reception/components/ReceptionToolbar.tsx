import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  FileEdit,
} from "lucide-react";
import dayjs, { type Dayjs } from "dayjs";
import { DateNavigator, type DateNavigatorMode } from "@/components/DateNavigator";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { t } from "@/lib/i18n";

// The segmented control below offers only these three, so "year" can never
// reach onViewModeChange. Widening it to DateNavigatorMode made the prop
// unassignable from the page's own day|week|month state.
type ViewMode = Exclude<DateNavigatorMode, "year">;

interface ReceptionToolbarProps {
  keyword?: string;
  viewMode?: ViewMode;
  currentDate?: Dayjs;
  onSearchChange: (value: string) => void;
  onDoctorSelect: (doctorId: string | undefined) => void;
  onCreateClick: () => void;
  onViewModeChange?: (mode: ViewMode) => void;
  onDateChange?: (date: Dayjs) => void;
}

export const ReceptionToolbar: React.FC<ReceptionToolbarProps> = ({
  keyword = "",
  viewMode = "day",
  currentDate,
  onSearchChange,
  onCreateClick,
  onViewModeChange,
  onDateChange,
}) => {
  const date = currentDate ?? dayjs();

  return (
    <div className="reception-toolbar">
      <div className="reception-toolbar-left">
        <SegmentedControl
          options={[
            { key: "day" as ViewMode, label: t("Ngày") },
            { key: "week" as ViewMode, label: t("Tuần") },
            { key: "month" as ViewMode, label: t("Tháng") },
          ]}
          value={viewMode}
          onChange={(v) => onViewModeChange?.(v)}
          className="shrink-0"
        />

        <DateNavigator
          value={date}
          mode={viewMode}
          onChange={(d) => onDateChange?.(d)}
        />

        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("Tìm bệnh nhân...")}
            value={keyword}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="reception-toolbar-right">
        <Button
          onClick={onCreateClick}
          className="font-semibold"
        >
          <FileEdit size={14} className="mr-1.5" />
          {t("Tạo tiếp nhận")}
        </Button>
      </div>
    </div>
  );
};
