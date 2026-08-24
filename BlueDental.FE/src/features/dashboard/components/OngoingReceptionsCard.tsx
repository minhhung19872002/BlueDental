import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useReceptionList } from "@/features/reception/api/receptionQueries";
import type { ReceptionStatus } from "@/features/reception/types/reception";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

const MAX_ROWS = 6;

/** The two in-flight states the panel can show; Completed rows are filtered out. */
const STATUS_LOOK: Partial<Record<ReceptionStatus, { label: string; color: string }>> = {
  WaitingForExam: { label: "Chờ khám", color: brand.blue },
  InProgress: { label: "Đang khám", color: brand.goldDeep },
};

/** Today's visits that are not finished yet, in the design's compact row form. */
export function OngoingReceptionsCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useReceptionList({});

  const rows = (data?.items ?? [])
    .filter((item) => item.status !== "Completed")
    .slice(0, MAX_ROWS);

  return (
    <div className="page-card dash-flush-card">
      <div className="dash-panel-head">
        <div className="dash-card-title">{t("Lượt tiếp nhận đang diễn ra")}</div>
        <button
          type="button"
          className="dash-link"
          onClick={() => navigate("/reception")}
        >
          {t("Xem tất cả →")}
        </button>
      </div>

      {isLoading ? (
        <div className="dash-panel-body">
          <Loader2 className="size-4 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="dash-panel-body">
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-sm gap-2">
            <p>{t("Không có lượt tiếp nhận đang diễn ra")}</p>
          </div>
        </div>
      ) : (
        <div>
          {rows.map((item) => {
            const status = STATUS_LOOK[item.status];
            return (
              <button
                key={item.id}
                type="button"
                className="dash-reception-row"
                onClick={() => navigate("/reception")}
              >
                <span className="dash-reception-time">
                  {item.appointmentTime ?? item.arrivalTime ?? "—"}
                </span>
                <span className="dash-reception-patient">
                  <span className="dash-row-title">{item.patientName || "—"}</span>
                  <span className="dash-row-caption">{item.voucherCode}</span>
                </span>
                <span className="dash-reception-service">
                  {item.services?.[0] ?? "—"}
                </span>
                <span className="dash-reception-doctor">{item.doctorName || "—"}</span>
                <span
                  className="dash-pill"
                  style={{ color: status?.color, background: `${status?.color}16` }}
                >
                  {t(status?.label ?? "Chờ khám")}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
