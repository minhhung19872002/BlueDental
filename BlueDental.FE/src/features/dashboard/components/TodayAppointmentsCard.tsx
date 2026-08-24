import { Loader2 } from "lucide-react";
import { Calendar } from "lucide-react";
import { useAppointmentList } from "@/features/appointments/api/appointmentQueries";
import dayjs from "dayjs";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

export function TodayAppointmentsCard() {
  const today = dayjs().format("YYYY-MM-DD");
  const { data, isLoading } = useAppointmentList({
    date: today,
    maxResultCount: 100,
  });

  const total = data?.totalCount ?? 0;
  const completed = data?.items.filter((a) => a.status === "completed").length ?? 0;
  const upcoming = data?.items.filter((a) => a.status === "scheduled" || a.status === "confirmed").length ?? 0;

  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <div>
          <div className="stat-card-label">{t("Lịch hẹn hôm nay")}</div>
          {isLoading ? (
            <Loader2 className="size-4 animate-spin text-primary mt-2" />
          ) : (
            <div className="stat-card-value">{total}</div>
          )}
        </div>
        <div
          className="stat-card-icon"
          style={{ background: brand.bluePale, color: brand.blue }}
        >
          <Calendar className="size-4" />
        </div>
      </div>
      <div className="stat-card-footer">
        {completed} {t("hoàn thành ·")} {upcoming} {t("sắp đến")}
      </div>
    </div>
  );
}
