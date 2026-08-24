import { useAppointmentList } from "../api/appointmentQueries";
import { StatusBadge } from "./StatusBadge";
import type { Appointment, AppointmentStatus } from "../types/appointment";
import { formatDateTime } from "@/utils/format";
import { t } from "@/lib/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

interface PatientAppointmentPanelProps {
  patientId: string;
}

/** The counters the reference shows above a patient's appointment list. */
const counters = (): { status: AppointmentStatus; label: string; color: string; bg: string }[] => [
  { status: "scheduled", label: t("Đã hẹn"), color: "#1c3566", bg: "#eaf0fa" },
  { status: "confirmed", label: t("Đã xác nhận"), color: "#1f8a63", bg: "#e6f5ef" },
  { status: "cancelled", label: t("Đã huỷ"), color: "#ef4d4d", bg: "#FCE8E6" },
  { status: "noShow", label: t("Trễ hẹn"), color: "#dd9426", bg: "#FEF3C7" },
];

/** Lịch hẹn tab of a patient record. */
export function PatientAppointmentPanel({ patientId }: PatientAppointmentPanelProps) {
  const { data, isLoading } = useAppointmentList({ patientId, maxResultCount: 50 });

  const rows = data?.items ?? [];

  return (
    <div>
      <div
        style={{ display: "flex", gap: 10, marginBottom: 16 }}
        data-testid="patient-appointment-counters"
      >
        {counters().map((counter) => (
          <div
            key={counter.status}
            style={{
              minWidth: 70,
              minHeight: 55,
              padding: "8px 14px",
              borderTop: `3px solid ${counter.color}`,
              backgroundColor: counter.bg,
              borderRadius: 8,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: counter.color }}>
              {rows.filter((row) => row.status === counter.status).length}
            </div>
            <div style={{ fontSize: 11, color: counter.color }}>{counter.label}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">{t("Đang tải...")}</div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">{t("Chưa có lịch hẹn")}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">{t("Thời gian")}</TableHead>
                    <TableHead className="w-40">{t("Bác sĩ")}</TableHead>
                    <TableHead>{t("Nội dung")}</TableHead>
                    <TableHead className="w-36">{t("Trạng thái")}</TableHead>
                    <TableHead className="w-48">{t("Ghi chú")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: Appointment) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDateTime(row.startTime)}</TableCell>
                      <TableCell>{row.doctorName || "—"}</TableCell>
                      <TableCell>{row.reason ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell>{row.notes ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
