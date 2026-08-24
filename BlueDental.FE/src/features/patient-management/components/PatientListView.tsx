import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import {
  Plus,
  Search,
  ExternalLink,
  Eye,
  Pencil,
} from "lucide-react";
import dayjs, { type Dayjs } from "dayjs";
import { usePatientList } from "../api/patientQueries";
import { patientApi } from "../api/patientApi";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate, formatDateTime, formatVND } from "@/utils/format";
import { exportToExcel } from "@/utils/exportExcel";
import { SearchSelect } from "@/components/SearchSelect";
import { StatusBadge } from "@/components/StatusBadge";
import { DateNavigator } from "@/components/DateNavigator";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { PatientListItem, PatientStatus } from "../types/patient";
import { t } from "@/lib/i18n";

type ViewMode = "day" | "week" | "month";
type FilterStatus = "All" | PatientStatus;

interface Props {
  onAdd?: () => void;
  onRowClick?: (patient: PatientListItem) => void;
  onEdit?: (id: string) => void;
}

export function PatientListView({ onAdd, onRowClick, onEdit }: Props) {

  const STATUS_CONFIG: Record<PatientStatus, { label: string; bg: string; text: string }> = {
    NoActivity:  { label: t("Chưa phát sinh"), bg: "#F3F4F6", text: "#374151" },
    InTreatment: { label: t("Đang điều trị"),  bg: "#EBF3FE", text: "#1E5BB0" },
    Completed:   { label: t("Hoàn tất"),       bg: "#E6F4EA", text: "#1F7A45" },
  };

  const FILTER_TABS: { key: FilterStatus; label: string }[] = [
    { key: "All",         label: t("Tất cả") },
    { key: "Completed",   label: t("Điều trị hoàn tất") },
    { key: "InTreatment", label: t("Đang điều trị") },
    { key: "NoActivity",  label: t("Chưa phát sinh") },
  ];

  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [keyword, setKeyword] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("All");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>();
  const debouncedKeyword = useDebounce(keyword);
  const pagination = useTablePagination(20);

  const { data, isLoading } = usePatientList({
    keyword: debouncedKeyword || undefined,
    status: filterStatus === "All" ? undefined : filterStatus,
    doctorId: selectedDoctorId,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await patientApi.list({
        keyword: debouncedKeyword || undefined,
        status: filterStatus === "All" ? undefined : filterStatus,
        doctorId: selectedDoctorId,
        maxResultCount: 10000,
      });
      exportToExcel(
        result.items,
        [
          { header: t("Mã BN"), key: "code" },
          { header: t("Họ và tên"), key: "fullName" },
          { header: t("Ngày sinh"), key: "dateOfBirth", format: (v) => (v ? formatDate(String(v)) : "") },
          { header: t("Số điện thoại"), key: "phone" },
          { header: t("Trạng thái"), key: "status", format: (v) => STATUS_CONFIG[v as PatientStatus]?.label ?? String(v) },
          { header: t("Dịch vụ"), key: "serviceName", format: (v) => String(v ?? "") },
          { header: t("Bác sĩ"), key: "doctorName", format: (v) => String(v ?? "") },
          { header: t("Số tiền"), key: "totalAmount", format: (v) => formatVND(Number(v ?? 0)) },
          { header: t("Thực thu"), key: "collectedAmount", format: (v) => formatVND(Number(v ?? 0)) },
          { header: t("Công nợ"), key: "debtAmount", format: (v) => formatVND(Number(v ?? 0)) },
          { header: t("Lịch hẹn gần nhất"), key: "nextAppointmentAt", format: (v) => (v ? formatDateTime(String(v)) : "") },
          { header: t("Lần khám cuối"), key: "lastVisitAt", format: (v) => (v ? formatDateTime(String(v)) : "") },
          { header: t("Ngày tạo hồ sơ"), key: "createdAt", format: (v) => formatDate(String(v)) },
        ],
        `danh-sach-benh-nhan-${dayjs().format("YYYYMMDD")}`,
      );
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setExporting(false);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="reception-page">
      {/* Toolbar card */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Left: view mode + date nav + search */}
          <SegmentedControl
            options={[
              { key: "day" as ViewMode, label: t("Ngày") },
              { key: "week" as ViewMode, label: t("Tuần") },
              { key: "month" as ViewMode, label: t("Tháng") },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />

          <DateNavigator
            value={currentDate}
            mode={viewMode}
            onChange={setCurrentDate}
          />

          <div className="relative flex-1" style={{ maxWidth: 240 }}>
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-7"
              placeholder={t("Tìm kiếm")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          {/* Right: export + create */}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <Button variant="outline" disabled={exporting} onClick={handleExport}>
              <ExternalLink size={14} className="mr-2" />
              {t("Xuất file")}
            </Button>
            <Button onClick={onAdd}>
              <Plus size={14} className="mr-2" />
              {t("Tạo hồ sơ")}
            </Button>
          </div>
        </div>
      </div>

      {/* Filter row card */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Status tabs */}
          <div className="reception-status-pills">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`reception-status-pill ${filterStatus === tab.key ? "reception-status-pill--active" : ""}`}
                onClick={() => setFilterStatus(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filter dropdowns */}
          <div style={{ display: "flex", gap: 8 }}>
            <SearchSelect
              value={selectedDoctorId}
              placeholder={t("Bác sĩ")}
              allowClear
              options={[]}
              onChange={(v) => setSelectedDoctorId(v)}
              style={{ width: 160 }}
            />
            <SearchSelect
              value={undefined}
              placeholder={t("Phân loại dịch vụ")}
              allowClear
              options={[]}
              onChange={() => {}}
              style={{ width: 180 }}
            />
            <SearchSelect
              value={undefined}
              placeholder={t("Phân loại theo Tag")}
              allowClear
              options={[]}
              onChange={() => {}}
              style={{ width: 180 }}
            />
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="reception-card patient-table-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 130 }}>{t("Ngày tạo hồ sơ")}</TableHead>
                <TableHead style={{ width: 220 }}>{t("Họ và tên")}</TableHead>
                <TableHead style={{ width: 110 }}>{t("Ngày sinh")}</TableHead>
                <TableHead style={{ width: 120 }}>{t("Số điện thoại")}</TableHead>
                <TableHead style={{ width: 140 }}>{t("Trạng thái")}</TableHead>
                <TableHead style={{ width: 180 }}>{t("Dịch vụ")}</TableHead>
                <TableHead style={{ width: 140 }}>{t("Bác sĩ")}</TableHead>
                <TableHead style={{ width: 100 }} className="text-right">{t("Số tiền")}</TableHead>
                <TableHead style={{ width: 100 }} className="text-right">{t("Thực thu")}</TableHead>
                <TableHead style={{ width: 100 }} className="text-right">{t("Công nợ")}</TableHead>
                <TableHead style={{ width: 150 }}>{t("Lịch hẹn gần nhất")}</TableHead>
                <TableHead style={{ width: 130 }}>{t("Lần khám cuối")}</TableHead>
                <TableHead style={{ width: 80 }} className="text-center">{t("Thao tác")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-10 text-muted-foreground">
                    {t("Đang tải...")}
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-10">
                    <div className="text-3xl mb-2">🦷</div>
                    <div className="font-medium text-muted-foreground">{t("Không có bệnh nhân nào")}</div>
                    <div className="text-sm text-muted-foreground mt-1">{t("Thêm hồ sơ bệnh nhân đầu tiên")}</div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((record: PatientListItem) => {
                  const conf = STATUS_CONFIG[record.status] ?? { label: record.status, bg: "#F3F4F6", text: "#374151" };
                  return (
                    <TableRow
                      key={record.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onRowClick?.(record)}
                    >
                      <TableCell className="text-xs" style={{ color: "#374151" }}>
                        {formatDate(record.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span
                          className="font-bold text-xs cursor-pointer"
                          style={{ color: "#2671D8" }}
                          onClick={(e) => { e.stopPropagation(); onRowClick?.(record); }}
                        >
                          [{record.code}] - {record.fullName?.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {record.dateOfBirth ? formatDate(record.dateOfBirth) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{record.phone}</TableCell>
                      <TableCell>
                        <StatusBadge label={conf.label} bg={conf.bg} color={conf.text} />
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: "#374151" }}>
                        {record.serviceName ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">{record.doctorName ?? "—"}</TableCell>
                      <TableCell className="text-xs text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {record.totalAmount ? formatVND(record.totalAmount) : "0"}
                      </TableCell>
                      <TableCell
                        className="text-xs text-right"
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          color: record.collectedAmount > 0 ? "#10B981" : "#374151",
                          fontWeight: record.collectedAmount > 0 ? 600 : 400,
                        }}
                      >
                        {record.collectedAmount ? formatVND(record.collectedAmount) : "0"}
                      </TableCell>
                      <TableCell
                        className="text-xs text-right"
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          color: record.debtAmount > 0 ? "#EF4444" : "#374151",
                          fontWeight: record.debtAmount > 0 ? 600 : 400,
                        }}
                      >
                        {record.debtAmount ? formatVND(record.debtAmount) : "0"}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: record.nextAppointmentAt ? "#374151" : "#9CA3AF" }}>
                        {record.nextAppointmentAt ? formatDateTime(record.nextAppointmentAt) : "—"}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: record.lastVisitAt ? "#374151" : "#9CA3AF" }}>
                        {record.lastVisitAt ? formatDateTime(record.lastVisitAt) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title={t("Xem hồ sơ")}
                            onClick={(e) => { e.stopPropagation(); onRowClick?.(record); }}
                            style={{ color: "#2671D8" }}
                          >
                            <Eye size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title={t("Chỉnh sửa")}
                            style={{ color: "#6B7280" }}
                            onClick={(e) => { e.stopPropagation(); onEdit?.(record.id); }}
                          >
                            <Pencil size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {data && data.totalCount > 0 && (
          <div className="flex items-center justify-between px-2 py-3 text-sm text-muted-foreground">
            <span>
              {t(
                "Hiển thị {0}–{1} trên {2} bệnh nhân",
                Math.min(pagination.skipCount + 1, data.totalCount),
                Math.min(pagination.skipCount + pagination.maxResultCount, data.totalCount),
                data.totalCount,
              )}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => pagination.buildConfig(data.totalCount).onChange(pagination.page - 1, pagination.pageSize)}
              >
                {t("Trước")}
              </Button>
              <span className="text-xs">{pagination.page}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.skipCount + pagination.maxResultCount >= data.totalCount}
                onClick={() => pagination.buildConfig(data.totalCount).onChange(pagination.page + 1, pagination.pageSize)}
              >
                {t("Sau")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
