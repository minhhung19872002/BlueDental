import { t } from "@/lib/i18n";

interface Props {
  onExitFullscreen: () => void;
  onCreateTemp: () => void;
  onCreateAppointment: () => void;
  onTogglePanel: () => void;
  filterCount?: number;
}

export function CalendarFabs({
  onExitFullscreen,
  onCreateTemp,
  onCreateAppointment,
  onTogglePanel,
  filterCount = 0,
}: Props) {
  return (
    <div className="cal-fabs">
      <button
        type="button"
        className="cal-fab cal-fab--exit"
        title={t("Thoát toàn màn hình")}
        onClick={onExitFullscreen}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
        </svg>
      </button>
      <button
        type="button"
        className="cal-fab cal-fab--temp"
        title={t("Tạo lịch tạm")}
        onClick={onCreateTemp}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <path d="M12 14v4m-2-2h4" />
        </svg>
      </button>
      <button
        type="button"
        className="cal-fab cal-fab--create"
        title={t("Tạo lịch hẹn mới")}
        onClick={onCreateAppointment}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      <button
        type="button"
        className="cal-fab cal-fab--filter"
        title={t("Bảng điều khiển")}
        onClick={onTogglePanel}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {filterCount > 0 && (
          <span className="cal-fab-badge">{filterCount}</span>
        )}
      </button>
    </div>
  );
}
