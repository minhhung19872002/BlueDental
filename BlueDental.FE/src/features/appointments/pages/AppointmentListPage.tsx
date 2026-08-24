import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus } from "lucide-react";
import { useAppointmentList } from "../api/appointmentQueries";
import { AppointmentEditorModal } from "../components/AppointmentEditorModal";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useDebounce } from "@/hooks/useDebounce";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "@/utils/format";
import dayjs from "dayjs";
import type { Appointment } from "../types/appointment";
import { t } from "@/lib/i18n";

type StatusFilter = "all" | "scheduled" | "confirmed" | "inProgress" | "completed" | "cancelled";

const statusTabs = (): { key: StatusFilter; label: string }[] => [
  { key: "all",        label: t("Tất cả") },
  { key: "scheduled",  label: t("Đã hẹn") },
  { key: "confirmed",  label: t("Đã xác nhận") },
  { key: "inProgress", label: t("Đang khám") },
  { key: "completed",  label: t("Hoàn thành") },
  { key: "cancelled",  label: t("Đã hủy") },
];

export function AppointmentListPage() {
  const pagination = useTablePagination(20);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const debouncedKeyword = useDebounce(keyword);

  // Search and status go to the server. Filtering the fetched page instead meant
  // a clinic with more than one page of history could never find anything past
  // the first twenty rows.
  const { data, isLoading } = useAppointmentList({
    filter: debouncedKeyword || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const appointments = data?.items ?? [];

  return (
    <div className="reception-page">
      {/* Toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("Tìm kiếm bệnh nhân, bác sĩ, lý do khám...")}
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  pagination.resetToFirstPage();
                }}
                className="pl-8 w-72"
              />
            </div>
            <Select>
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t("Bác sĩ điều trị")} />
              </SelectTrigger>
              <SelectContent>
                {/* doctor options loaded dynamically */}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setEditorOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            {t("Tạo lịch hẹn")}
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {statusTabs().map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatusFilter(tab.key);
                pagination.resetToFirstPage();
              }}
              style={{
                padding: "8px 16px",
                border: "none",
                borderBottom: statusFilter === tab.key ? "2px solid #1c3566" : "2px solid transparent",
                background: "none",
                color: statusFilter === tab.key ? "#1c3566" : "#6f7c90",
                fontWeight: statusFilter === tab.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="reception-card reception-card--content">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Bệnh nhân")}</TableHead>
                <TableHead>{t("Bác sĩ")}</TableHead>
                <TableHead>{t("Ngày khám")}</TableHead>
                <TableHead className="w-36">{t("Giờ")}</TableHead>
                <TableHead className="w-36">{t("Trạng thái")}</TableHead>
                <TableHead>{t("Lý do")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t("Đang tải...")}
                  </TableCell>
                </TableRow>
              ) : appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t("Không có dữ liệu")}
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map((record: Appointment) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.patientName}</TableCell>
                    <TableCell>{record.doctorName}</TableCell>
                    <TableCell>{formatDate(record.startTime)}</TableCell>
                    <TableCell>
                      {dayjs(record.startTime).format("HH:mm")} – {dayjs(record.endTime).format("HH:mm")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                    <TableCell>
                      {record.reason ?? (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">{t("Định kỳ")}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {(data?.totalCount ?? 0) > pagination.maxResultCount && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-muted-foreground">
            <span>{t("Tổng số {0} lịch hẹn", data?.totalCount ?? 0)}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.skipCount === 0}
                onClick={() => pagination.resetToFirstPage()}
              >
                {t("Trang trước")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <AppointmentEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSuccess={() => setEditorOpen(false)}
      />
    </div>
  );
}
