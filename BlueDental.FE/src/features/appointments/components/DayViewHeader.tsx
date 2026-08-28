import { t } from "@/lib/i18n";

export interface DayViewDoctor {
  id: string;
  name: string;
  appointmentCount?: number;
}

interface Props {
  doctors: DayViewDoctor[];
  countsByDoctor: Map<string, number>;
  timeColWidth: number;
}

export function DayViewHeader({ doctors, countsByDoctor, timeColWidth }: Props) {
  return (
    <>
      <div className="cal-day-time-header" style={{ width: timeColWidth }}>
        <div className="cal-week-time-header-label">
          {t("Giờ /")}
          {t("Nhân viên")}
        </div>
      </div>
      {doctors.length === 0 ? (
        <div className="cal-day-doctor-header">{t("Không có bác sĩ")}</div>
      ) : (
        doctors.map((doc) => (
          <div key={doc.id} className="cal-day-doctor-header">
            {doc.name}
            <span className="cal-day-doctor-count">({countsByDoctor.get(doc.id) ?? 0})</span>
          </div>
        ))
      )}
    </>
  );
}
