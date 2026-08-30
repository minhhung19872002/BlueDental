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
  canPrev?: boolean;
  canNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

function PageButton({ direction, onClick }: { direction: "prev" | "next"; onClick?: () => void }) {
  return (
    <button
      type="button"
      className={`cal-day-page-btn cal-day-page-btn--${direction}`}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {direction === "prev"
          ? <polyline points="15 18 9 12 15 6" />
          : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  );
}

export function DayViewHeader({ doctors, countsByDoctor, timeColWidth, canPrev, canNext, onPrev, onNext }: Props) {
  const showNav = canPrev || canNext;

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
        doctors.map((doc, i) => {
          const isFirst = i === 0;
          const isLast = i === doctors.length - 1;
          return (
            <div key={doc.id} className="cal-day-doctor-header">
              {showNav && isFirst && canPrev && <PageButton direction="prev" onClick={onPrev} />}
              {showNav && isFirst && !canPrev && <span className="cal-day-page-spacer" />}
              <span className="cal-day-doctor-name">
                {doc.name}
                <span className="cal-day-doctor-count"> ({countsByDoctor.get(doc.id) ?? 0})</span>
              </span>
              {showNav && isLast && canNext && <PageButton direction="next" onClick={onNext} />}
              {showNav && isLast && !canNext && <span className="cal-day-page-spacer" />}
            </div>
          );
        })
      )}
    </>
  );
}
