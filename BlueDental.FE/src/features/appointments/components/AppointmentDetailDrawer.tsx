// AppointmentDetailDrawer — Shows appointment details in a side drawer.
// TODO: Add quick-action buttons (confirm, cancel, mark as no-show).

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { useAppointment } from "../api/appointmentQueries";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/utils/format";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";

interface Props {
  appointmentId: string | null;
  onClose: () => void;
}

export function AppointmentDetailDrawer({ appointmentId, onClose }: Props) {
  const { data: appointment, isLoading } = useAppointment(
    appointmentId ?? "",
  );

  return (
    <Sheet open={Boolean(appointmentId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent style={{ width: 480 }}>
        <SheetHeader>
          <SheetTitle>{t("Chi tiết lịch hẹn")}</SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}

        {appointment && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm mt-4">
            <dt className="font-medium text-muted-foreground">{t("Bệnh nhân")}</dt>
            <dd>{appointment.patientName}</dd>

            <dt className="font-medium text-muted-foreground">{t("Điện thoại")}</dt>
            <dd>{appointment.patientPhone}</dd>

            <dt className="font-medium text-muted-foreground">{t("Bác sĩ")}</dt>
            <dd>{appointment.doctorName}</dd>

            <dt className="font-medium text-muted-foreground">{t("Ngày khám")}</dt>
            <dd>{formatDate(appointment.startTime)}</dd>

            <dt className="font-medium text-muted-foreground">{t("Giờ khám")}</dt>
            <dd>
              {dayjs(appointment.startTime).format("HH:mm")} –{" "}
              {dayjs(appointment.endTime).format("HH:mm")}
            </dd>

            <dt className="font-medium text-muted-foreground">{t("Trạng thái")}</dt>
            <dd><StatusBadge status={appointment.status} /></dd>

            <dt className="font-medium text-muted-foreground">{t("Lý do khám")}</dt>
            <dd>{appointment.reason ?? t("Khám định kỳ")}</dd>

            <dt className="font-medium text-muted-foreground">{t("Ghi chú")}</dt>
            <dd>{appointment.notes ?? "—"}</dd>
          </dl>
        )}
      </SheetContent>
    </Sheet>
  );
}
