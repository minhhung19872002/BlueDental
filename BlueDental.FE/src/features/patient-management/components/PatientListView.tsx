import { useState } from "react";
import { Table, Button, Space, Typography, Tooltip, Segmented, Input, message } from "antd";
import type { TableColumnsType } from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  ExportOutlined,
  EyeOutlined,
  EditOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { usePatientList } from "../api/patientQueries";
import { patientApi } from "../api/patientApi";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate, formatDateTime, formatVND } from "@/utils/format";
import { exportToExcel } from "@/utils/exportExcel";
import { SearchSelect } from "@/components/SearchSelect";
import type { PatientListItem, PatientStatus } from "../types/patient";
import { t } from "@/lib/i18n";

const { Text } = Typography;

type ViewMode = "day" | "week" | "month";
type FilterStatus = "All" | PatientStatus;

interface Props {
  onAdd?: () => void;
  onRowClick?: (patient: PatientListItem) => void;
  onEdit?: (id: string) => void;
}

export function PatientListView({ onAdd, onRowClick, onEdit }: Props) {

  const STATUS_CONFIG: Record<PatientStatus, { label: string; color: string; bg: string; text: string }> = {
    NoActivity:  { label: t("Chưa phát sinh"),  color: "#6B7280", bg: "#F3F4F6", text: "#374151" },
    InTreatment: { label: t("Đang điều trị"), color: "#2671D8", bg: "#EBF3FE", text: "#1E5BB0" },
    Completed:   { label: t("Điều trị hoàn tất"),   color: "#10B981", bg: "#E6F4EA", text: "#1F7A45" },
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

  const navigateDate = (dir: 1 | -1) => {
    const unit = viewMode === "day" ? "day" : viewMode === "week" ? "week" : "month";
    setCurrentDate((d) => d.add(dir, unit));
  };

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
    } catch {
      message.error(t("Xuất file thất bại"));
    } finally {
      setExporting(false);
    }
  };

  const displayDate = () => {
    if (viewMode === "day") return currentDate.format("DD/MM/YYYY");
    if (viewMode === "week") {
      const start = currentDate.startOf("week").format("DD/MM");
      const end = currentDate.endOf("week").format("DD/MM/YYYY");
      return `${start} – ${end}`;
    }
    return currentDate.format("MM/YYYY");
  };

  const columns: TableColumnsType<PatientListItem> = [
    {
      title: t("Ngày tạo hồ sơ"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (v: string) => (
        <Text style={{ fontSize: 13, color: "#374151" }}>{formatDate(v)}</Text>
      ),
    },
    {
      title: t("Họ và tên"),
      key: "fullName",
      width: 220,
      render: (_, record) => (
        <div>
          <div>
            <Text style={{ color: "#5A6B82", fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>
              [{record.code}]
            </Text>{" "}
            <Text
              strong
              style={{ color: "#2671D8", cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); onRowClick?.(record); }}
            >
              {record.fullName}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: t("Ngày sinh"),
      dataIndex: "dateOfBirth",
      key: "dateOfBirth",
      width: 110,
      render: (v: string | null) => (
        <Text style={{ fontSize: 13 }}>{v ? formatDate(v) : "—"}</Text>
      ),
    },
    {
      title: t("Số điện thoại"),
      dataIndex: "phone",
      key: "phone",
      width: 120,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      key: "status",
      width: 150,
      render: (status: PatientStatus) => {
        const conf = STATUS_CONFIG[status] ?? { label: status, bg: "#F3F4F6", text: "#374151" };
        return (
          <span
            style={{
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: 12,
              backgroundColor: conf.bg,
              color: conf.text,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {conf.label}
          </span>
        );
      },
    },
    {
      title: t("Dịch vụ"),
      dataIndex: "serviceName",
      key: "serviceName",
      width: 180,
      render: (v: string | null) => (
        <Text style={{ fontSize: 13, color: "#374151" }}>{v ?? "—"}</Text>
      ),
    },
    {
      title: t("Bác sĩ"),
      dataIndex: "doctorName",
      key: "doctorName",
      width: 140,
      render: (v: string | null) => (
        <Text style={{ fontSize: 13 }}>{v ?? "—"}</Text>
      ),
    },
    {
      title: t("Số tiền"),
      dataIndex: "totalAmount",
      key: "totalAmount",
      width: 120,
      align: "right",
      render: (v: number) => (
        <Text style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
          {formatVND(v)}
        </Text>
      ),
    },
    {
      title: t("Thực thu"),
      dataIndex: "collectedAmount",
      key: "collectedAmount",
      width: 120,
      align: "right",
      render: (v: number) => (
        <Text
          style={{
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
            color: v > 0 ? "#10B981" : "#374151",
            fontWeight: v > 0 ? 500 : 400,
          }}
        >
          {formatVND(v)}
        </Text>
      ),
    },
    {
      title: t("Công nợ"),
      dataIndex: "debtAmount",
      key: "debtAmount",
      width: 120,
      align: "right",
      render: (v: number) => (
        <Text
          style={{
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
            color: v > 0 ? "#EF4444" : "#374151",
            fontWeight: v > 0 ? 500 : 400,
          }}
        >
          {formatVND(v)}
        </Text>
      ),
    },
    {
      title: t("Lịch hẹn gần nhất"),
      dataIndex: "nextAppointmentAt",
      key: "nextAppointmentAt",
      width: 145,
      render: (v: string | null) => (
        <Text style={{ fontSize: 12, color: v ? "#374151" : "#9CA3AF" }}>
          {v ? formatDateTime(v) : "—"}
        </Text>
      ),
    },
    {
      title: t("Lần khám cuối"),
      dataIndex: "lastVisitAt",
      key: "lastVisitAt",
      width: 130,
      render: (v: string | null) => (
        <Text style={{ fontSize: 12, color: v ? "#374151" : "#9CA3AF" }}>
          {v ? formatDateTime(v) : "—"}
        </Text>
      ),
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 90,
      fixed: "right",
      align: "center",
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title={t("Xem hồ sơ")}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => { e.stopPropagation(); onRowClick?.(record); }}
              style={{ color: "#2671D8" }}
            />
          </Tooltip>
          <Tooltip title={t("Chỉnh sửa")}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              style={{ color: "#6B7280" }}
              onClick={(e) => { e.stopPropagation(); onEdit?.(record.id); }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="reception-page">
      {/* Toolbar card */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Left: view mode + date nav */}
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { label: t("Ngày"), value: "day" },
              { label: t("Tuần"), value: "week" },
              { label: t("Tháng"), value: "month" },
            ]}
            style={{ fontWeight: 500 }}
          />
          <Space size={4}>
            <Button
              type="text"
              size="small"
              icon={<LeftOutlined />}
              onClick={() => navigateDate(-1)}
            />
            <span
              style={{
                minWidth: 130,
                textAlign: "center",
                fontSize: 14,
                fontWeight: 500,
                color: "#1B2A41",
              }}
            >
              {displayDate()}
            </span>
            <Button
              type="text"
              size="small"
              icon={<RightOutlined />}
              onClick={() => navigateDate(1)}
            />
          </Space>

          {/* Center: search */}
          <Input
            prefix={<SearchOutlined style={{ color: "#9CA3AF" }} />}
            placeholder={t("Tìm kiếm...")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
            style={{ maxWidth: 240, flex: "1 1 200px" }}
          />

          {/* Right: export + create */}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <Button icon={<ExportOutlined />} loading={exporting} onClick={handleExport}>{t("Xuất file")}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
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
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
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
      <div className="reception-card reception-card--content">
        <Table<PatientListItem>
          rowKey="id"
          columns={columns}
          dataSource={data?.items}
          loading={isLoading}
          pagination={pagination.buildConfig(
            data?.totalCount,
            (total) => t("Hiển thị {0}–{1} trên {2} bệnh nhân", Math.min(pagination.skipCount + 1, total), Math.min(pagination.skipCount + pagination.maxResultCount, total), total),
          )}
          onRow={(record) => ({
            onClick: () => onRowClick?.(record),
            style: { cursor: "pointer" },
          })}
          scroll={{ x: 1400 }}
          locale={{
            emptyText: (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA3AF" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🦷</div>
                <div style={{ fontWeight: 500, color: "#6B7280" }}>{t("Không có bệnh nhân nào")}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{t("Thêm hồ sơ bệnh nhân đầu tiên")}</div>
              </div>
            ),
          }}
        />
      </div>
    </div>
  );
}
