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
import { useTranslation } from "react-i18next";
import { usePatientList } from "../api/patientQueries";
import { patientApi } from "../api/patientApi";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate, formatDateTime, formatVND } from "@/utils/format";
import { exportToExcel } from "@/utils/exportExcel";
import { SearchSelect } from "@/components/SearchSelect";
import type { PatientListItem, PatientStatus } from "../types/patient";

const { Text } = Typography;

type ViewMode = "day" | "week" | "month";
type FilterStatus = "All" | PatientStatus;

interface Props {
  onAdd?: () => void;
  onRowClick?: (patient: PatientListItem) => void;
  onEdit?: (id: string) => void;
}

export function PatientListView({ onAdd, onRowClick, onEdit }: Props) {
  const { t } = useTranslation();

  const STATUS_CONFIG: Record<PatientStatus, { label: string; color: string; bg: string; text: string }> = {
    NoActivity:  { label: t("patient.noActivity"),  color: "#6B7280", bg: "#F3F4F6", text: "#374151" },
    InTreatment: { label: t("patient.inTreatment"), color: "#2671D8", bg: "#EBF3FE", text: "#1E5BB0" },
    Completed:   { label: t("patient.completed"),   color: "#10B981", bg: "#E6F4EA", text: "#1F7A45" },
  };

  const FILTER_TABS: { key: FilterStatus; label: string }[] = [
    { key: "All",         label: t("patient.allPatients") },
    { key: "Completed",   label: t("patient.completed") },
    { key: "InTreatment", label: t("patient.inTreatment") },
    { key: "NoActivity",  label: t("patient.noActivity") },
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
          { header: t("patient.patientCode"), key: "code" },
          { header: t("patient.fullName"), key: "fullName" },
          { header: t("patient.dob"), key: "dateOfBirth", format: (v) => (v ? formatDate(String(v)) : "") },
          { header: t("common.phone"), key: "phone" },
          { header: t("common.status"), key: "status", format: (v) => STATUS_CONFIG[v as PatientStatus]?.label ?? String(v) },
          { header: t("patient.service"), key: "serviceName", format: (v) => String(v ?? "") },
          { header: t("patient.doctor"), key: "doctorName", format: (v) => String(v ?? "") },
          { header: t("patient.amount"), key: "totalAmount", format: (v) => formatVND(Number(v ?? 0)) },
          { header: t("patient.paid"), key: "collectedAmount", format: (v) => formatVND(Number(v ?? 0)) },
          { header: t("patient.debt"), key: "debtAmount", format: (v) => formatVND(Number(v ?? 0)) },
          { header: t("patient.nextAppointment"), key: "nextAppointmentAt", format: (v) => (v ? formatDateTime(String(v)) : "") },
          { header: t("patient.lastVisit"), key: "lastVisitAt", format: (v) => (v ? formatDateTime(String(v)) : "") },
          { header: t("patient.dateCreated"), key: "createdAt", format: (v) => formatDate(String(v)) },
        ],
        `danh-sach-benh-nhan-${dayjs().format("YYYYMMDD")}`,
      );
    } catch {
      message.error(t("patient.exportFailed"));
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
      title: t("patient.dateCreated"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (v: string) => (
        <Text style={{ fontSize: 13, color: "#374151" }}>{formatDate(v)}</Text>
      ),
    },
    {
      title: t("patient.fullName"),
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
      title: t("patient.dob"),
      dataIndex: "dateOfBirth",
      key: "dateOfBirth",
      width: 110,
      render: (v: string | null) => (
        <Text style={{ fontSize: 13 }}>{v ? formatDate(v) : "—"}</Text>
      ),
    },
    {
      title: t("common.phone"),
      dataIndex: "phone",
      key: "phone",
      width: 120,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: t("common.status"),
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
      title: t("patient.service"),
      dataIndex: "serviceName",
      key: "serviceName",
      width: 180,
      render: (v: string | null) => (
        <Text style={{ fontSize: 13, color: "#374151" }}>{v ?? "—"}</Text>
      ),
    },
    {
      title: t("patient.doctor"),
      dataIndex: "doctorName",
      key: "doctorName",
      width: 140,
      render: (v: string | null) => (
        <Text style={{ fontSize: 13 }}>{v ?? "—"}</Text>
      ),
    },
    {
      title: t("patient.amount"),
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
      title: t("patient.paid"),
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
      title: t("patient.debt"),
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
      title: t("patient.nextAppointment"),
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
      title: t("patient.lastVisit"),
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
      title: t("common.actions"),
      key: "actions",
      width: 90,
      fixed: "right",
      align: "center",
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title={t("patient.viewProfile")}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => { e.stopPropagation(); onRowClick?.(record); }}
              style={{ color: "#2671D8" }}
            />
          </Tooltip>
          <Tooltip title={t("common.edit")}>
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
              { label: t("common.day"), value: "day" },
              { label: t("common.week"), value: "week" },
              { label: t("common.month"), value: "month" },
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
            placeholder={t("common.search")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
            style={{ maxWidth: 240, flex: "1 1 200px" }}
          />

          {/* Right: export + create */}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <Button icon={<ExportOutlined />} loading={exporting} onClick={handleExport}>{t("patient.exportFile")}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
              {t("patient.createPatient")}
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
              placeholder={t("patient.doctorFilter")}
              allowClear
              options={[]}
              onChange={(v) => setSelectedDoctorId(v)}
              style={{ width: 160 }}
            />
            <SearchSelect
              value={undefined}
              placeholder={t("patient.serviceFilter")}
              allowClear
              options={[]}
              onChange={() => {}}
              style={{ width: 180 }}
            />
            <SearchSelect
              value={undefined}
              placeholder={t("patient.tagFilter")}
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
            (total) => t("patient.showRange", {
              from: Math.min(pagination.skipCount + 1, total),
              to: Math.min(pagination.skipCount + pagination.maxResultCount, total),
              total,
            }),
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
                <div style={{ fontWeight: 500, color: "#6B7280" }}>{t("patient.noPatients")}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{t("patient.addFirstPatient")}</div>
              </div>
            ),
          }}
        />
      </div>
    </div>
  );
}
