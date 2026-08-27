import { useState } from "react";
import { toast } from "sonner";
import { Table, Button, Space, Typography, Tooltip, Segmented, Input } from "antd";
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
import { usePatientTagOptions } from "@/hooks/usePatientTagOptions";
import { formatDate, formatDateTime, formatVND } from "@/utils/format";
import { exportToExcel } from "@/utils/exportExcel";
import { SearchSelect } from "@/components/SearchSelect";
import type { PatientListItem, PatientStatus } from "../types/patient";
import { PageHeader } from "@/components/PageHeader";
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
    NoActivity:  { label: t("Chưa phát sinh"),  color: "var(--bd-muted)", bg: "var(--bd-bg)", text: "var(--bd-sub)" },
    InTreatment: { label: t("Đang điều trị"), color: "var(--bd-blue)", bg: "var(--bd-blue-pale)", text: "#1E5BB0" },
    Completed:   { label: t("Điều trị hoàn tất"),   color: "var(--bd-green)", bg: "var(--bd-green-pale)", text: "#1F7A45" },
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
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>();
  const debouncedKeyword = useDebounce(keyword);
  const pagination = useTablePagination(20);
  const patientTags = usePatientTagOptions();

  const { data, isLoading } = usePatientList({
    keyword: debouncedKeyword || undefined,
    status: filterStatus === "All" ? undefined : filterStatus,
    doctorId: selectedDoctorId,
    tagId: selectedTagId,
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
        tagId: selectedTagId,
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
      toast.error(t("Xuất file thất bại"));
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
        <Text style={{ fontSize: 13, color: "var(--bd-sub)" }}>{formatDate(v)}</Text>
      ),
    },
    {
      title: t("Họ và tên"),
      key: "fullName",
      width: 220,
      render: (_, record) => (
        <div>
          <div>
            <Text style={{ color: "var(--bd-muted)", fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>
              [{record.code}]
            </Text>{" "}
            <Text
              strong
              style={{ color: "var(--bd-blue)", cursor: "pointer" }}
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
        const conf = STATUS_CONFIG[status] ?? { label: status, bg: "var(--bd-bg)", text: "var(--bd-sub)" };
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
        <Text style={{ fontSize: 13, color: "var(--bd-sub)" }}>{v ?? "—"}</Text>
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
            color: v > 0 ? "var(--bd-green)" : "var(--bd-sub)",
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
            color: v > 0 ? "var(--bd-red)" : "var(--bd-sub)",
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
        <Text style={{ fontSize: 12, color: v ? "var(--bd-sub)" : "var(--bd-faint)" }}>
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
        <Text style={{ fontSize: 12, color: v ? "var(--bd-sub)" : "var(--bd-faint)" }}>
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
              style={{ color: "var(--bd-blue)" }}
            />
          </Tooltip>
          <Tooltip title={t("Chỉnh sửa")}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              style={{ color: "var(--bd-muted)" }}
              onClick={(e) => { e.stopPropagation(); onEdit?.(record.id); }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Danh sách bệnh nhân")}
        subtitle={t("{0} hồ sơ khách hàng của phòng khám", data?.totalCount ?? 0)}
        actions={
          <>
            <Button icon={<ExportOutlined />} loading={exporting} onClick={handleExport}>
              {t("Xuất file")}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
              {t("Tạo hồ sơ")}
            </Button>
          </>
        }
      />

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
                color: "var(--bd-ink)",
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
            prefix={<SearchOutlined style={{ color: "var(--bd-faint)" }} />}
            placeholder={t("Tìm kiếm...")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
            style={{ maxWidth: 240, flex: "1 1 200px" }}
          />
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
              value={selectedTagId}
              placeholder={t("Phân loại theo Tag")}
              allowClear
              options={patientTags.data ?? []}
              onChange={(v) => {
                setSelectedTagId(v);
                pagination.resetToFirstPage();
              }}
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
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--bd-faint)" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🦷</div>
                <div style={{ fontWeight: 500, color: "var(--bd-muted)" }}>{t("Không có bệnh nhân nào")}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{t("Thêm hồ sơ bệnh nhân đầu tiên")}</div>
              </div>
            ),
          }}
        />
      </div>
    </div>
  );
}
