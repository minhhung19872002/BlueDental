import { useState } from "react";
import {
  CARE_OUTCOME,
  CARE_OUTCOME_LABELS,
  CARE_STATUS,
  CARE_STATUS_CONFIG,
  CARE_TYPE,
  CARE_TYPE_LABELS,
  useCareRecords,
  useCareStats,
  useFailCare,
  useMarkCareContacted,
  useMarkZaloSent,
  useSucceedCare,
  type CareRecordDto,
  type CareStatus,
  type CareType as CareTypeCode,
} from "../api/careApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { downloadFile } from "@/lib/download";
import { extractApiError } from "@/lib/apiError";
import { formatDate } from "@/utils/format";
import { Button, Input, Select, Table, Tag, message } from "antd";
import {
  SearchOutlined,
  DownloadOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/vi";

dayjs.locale("vi");

// ── Types ──────────────────────────────────────────────────────────────────

type TopTab = "care" | "grouping";
type ViewMode = "day" | "week" | "month";
type StatusFilter =
  | "total"
  | "success"
  | "failed"
  | "not-cared"
  | "zalo-sent";

// ── Constants ──────────────────────────────────────────────────────────────

const TOP_TABS: { key: TopTab; label: string }[] = [
  { key: "care", label: "Chăm sóc khách hàng" },
  { key: "grouping", label: "Phân nhóm CSKH" },
];

const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: "day", label: "Ngày" },
  { key: "week", label: "Tuần" },
  { key: "month", label: "Tháng" },
];

const STATUS_FILTERS: { key: StatusFilter; label: string; count: number }[] = [
  { key: "total", label: "Tổng khách", count: 0 },
  { key: "success", label: "Thành công", count: 0 },
  { key: "failed", label: "Thất bại", count: 0 },
  { key: "not-cared", label: "Chưa CS", count: 0 },
  { key: "zalo-sent", label: "Đã gửi Zalo", count: 0 },
];

const CARE_TYPES: { key: CareTypeCode; label: string }[] = (
  [
    CARE_TYPE.AfterTreatment,
    CARE_TYPE.Birthday,
    CARE_TYPE.AppointmentReminder,
    CARE_TYPE.Periodic,
    CARE_TYPE.Special,
  ] as CareTypeCode[]
).map((key) => ({ key, label: CARE_TYPE_LABELS[key] }));

/** The counter buttons double as status filters, as they do on the reference. */
const STATUS_BY_FILTER: Record<string, CareStatus | undefined> = {
  total: undefined,
  success: CARE_STATUS.Succeeded,
  failed: CARE_STATUS.Failed,
  "not-cared": CARE_STATUS.New,
  "zalo-sent": undefined,
};

// ── Component ──────────────────────────────────────────────────────────────

export function CskhGroupingPage() {
  const [topTab, setTopTab] = useState<TopTab>("care");
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("total");
  const [careType, setCareType] = useState<CareTypeCode>(CARE_TYPE.AfterTreatment);
  const [keyword, setKeyword] = useState("");

  const branchId = useCurrentBranchId();
  const markContacted = useMarkCareContacted();
  const succeedCare = useSucceedCare();
  const failCare = useFailCare();
  const markZaloSent = useMarkZaloSent();

  // The date navigator bounds the query the same way the reference does.
  const unit = viewMode === "day" ? "day" : viewMode === "week" ? "week" : "month";
  const careParams = {
    branchId,
    type: careType,
    status: STATUS_BY_FILTER[statusFilter],
    fromDate: currentDate.startOf(unit).toISOString(),
    toDate: currentDate.endOf(unit).toISOString(),
    filter: keyword.trim() || undefined,
    maxResultCount: 100,
  };

  const { data: careStats } = useCareStats({ ...careParams, status: undefined });
  const { data: carePage, isLoading: careLoading } = useCareRecords(careParams);

  const careRows = (carePage?.items ?? []).filter((row) =>
    // "Đã gửi Zalo" is a flag, not a status, so it filters client-side.
    statusFilter === "zalo-sent" ? row.zaloSentAt !== null : true,
  );

  const run = async (action: Promise<unknown>, successMessage: string) => {
    try {
      await action;
      message.success(successMessage);
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const careColumns = [
    {
      title: "Ngày chăm sóc",
      dataIndex: "dueAt",
      key: "dueAt",
      width: 130,
      render: (value: string | null, row: CareRecordDto) => formatDate(value ?? row.creationTime),
    },
    {
      title: "Họ và tên",
      dataIndex: "patientName",
      key: "patientName",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Số điện thoại",
      dataIndex: "patientPhone",
      key: "patientPhone",
      width: 130,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Bác sĩ điều trị",
      dataIndex: "assignedStaffName",
      key: "assignedStaffName",
      width: 150,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Nhân viên chăm sóc",
      dataIndex: "careStaffName",
      key: "careStaffName",
      width: 160,
      render: (value: string | null) => value ?? "Không có",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status: CareStatus) => {
        const config = CARE_STATUS_CONFIG[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "Đánh giá",
      dataIndex: "outcome",
      key: "outcome",
      width: 130,
      render: (outcome: keyof typeof CARE_OUTCOME_LABELS) => CARE_OUTCOME_LABELS[outcome],
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 240,
      render: (_: unknown, row: CareRecordDto) => (
        <>
          {row.status === CARE_STATUS.New && (
            <Button
              type="link"
              size="small"
              onClick={() => run(markContacted.mutateAsync(row.id), "Đã ghi nhận liên hệ")}
            >
              Đã liên hệ
            </Button>
          )}
          {(row.status === CARE_STATUS.New || row.status === CARE_STATUS.Contacted) && (
            <>
              <Button
                type="link"
                size="small"
                onClick={() =>
                  run(
                    succeedCare.mutateAsync({ id: row.id, outcome: CARE_OUTCOME.Good }),
                    "Đã ghi nhận chăm sóc thành công",
                  )
                }
              >
                Thành công
              </Button>
              <Button
                type="link"
                size="small"
                danger
                onClick={() =>
                  run(
                    failCare.mutateAsync({ id: row.id, reason: "Không liên hệ được" }),
                    "Đã ghi nhận thất bại",
                  )
                }
              >
                Thất bại
              </Button>
            </>
          )}
          {row.zaloSentAt === null && (
            <Button
              type="link"
              size="small"
              onClick={() => run(markZaloSent.mutateAsync(row.id), "Đã ghi nhận gửi Zalo")}
            >
              Gửi Zalo
            </Button>
          )}
        </>
      ),
    },
  ];

  const statusCounts: Record<StatusFilter, number> = {
    total: careStats?.totalPatients ?? 0,
    success: careStats?.succeeded ?? 0,
    failed: careStats?.failed ?? 0,
    "not-cared": careStats?.notCaredYet ?? 0,
    "zalo-sent": careStats?.zaloSent ?? 0,
  };

  const handlePrev = () => {
    if (viewMode === "day") setCurrentDate((d) => d.subtract(1, "day"));
    else if (viewMode === "week") setCurrentDate((d) => d.subtract(1, "week"));
    else setCurrentDate((d) => d.subtract(1, "month"));
  };

  const handleNext = () => {
    if (viewMode === "day") setCurrentDate((d) => d.add(1, "day"));
    else if (viewMode === "week") setCurrentDate((d) => d.add(1, "week"));
    else setCurrentDate((d) => d.add(1, "month"));
  };

  const formattedDate =
    viewMode === "month"
      ? currentDate.format("MM/YYYY")
      : currentDate.format("DD/MM/YYYY");

  return (
    <div className="reception-page">
      {/* Top-level tabs */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {TOP_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTopTab(tab.key)}
              style={{
                padding: "8px 20px",
                border: "none",
                borderBottom: topTab === tab.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: topTab === tab.key ? "#1677ff" : "#595959",
                fontWeight: topTab === tab.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar row 1: date navigation */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* View mode buttons */}
          <div style={{ display: "flex", border: "1px solid #d9d9d9", borderRadius: 6, overflow: "hidden" }}>
            {VIEW_MODES.map((vm) => (
              <button
                key={vm.key}
                onClick={() => setViewMode(vm.key)}
                style={{
                  padding: "5px 14px",
                  border: "none",
                  borderRight: "1px solid #d9d9d9",
                  background: viewMode === vm.key ? "#1677ff" : "#fff",
                  color: viewMode === vm.key ? "#fff" : "#595959",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: viewMode === vm.key ? 600 : 400,
                }}
              >
                {vm.label}
              </button>
            ))}
          </div>
          {/* Date navigator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              icon={<LeftOutlined />}
              size="small"
              onClick={handlePrev}
            />
            <span style={{ minWidth: 90, textAlign: "center", fontWeight: 500 }}>
              {formattedDate}
            </span>
            <Button
              icon={<RightOutlined />}
              size="small"
              onClick={handleNext}
            />
          </div>
        </div>
      </div>

      {/* Status counter buttons */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.key}
              onClick={() => setStatusFilter(sf.key)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                border: "1px solid",
                borderColor: statusFilter === sf.key ? "#1677ff" : "#d9d9d9",
                background: statusFilter === sf.key ? "#e6f4ff" : "#fff",
                color: statusFilter === sf.key ? "#1677ff" : "#595959",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: statusFilter === sf.key ? 600 : 400,
              }}
            >
              {statusCounts[sf.key]} {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Care type tabs */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
          {CARE_TYPES.map((ct) => (
            <button
              key={ct.key}
              onClick={() => setCareType(ct.key)}
              style={{
                padding: "8px 16px",
                border: "none",
                borderBottom: careType === ct.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: careType === ct.key ? "#1677ff" : "#595959",
                fontWeight: careType === ct.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar row 2 */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => void downloadFile("/v1/app/care-records/excel", "cskh.xlsx", careParams)}
          >
            Xuất Excel
          </Button>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm kiếm..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="Bác sĩ điều trị"
            style={{ width: 180 }}
            allowClear
            options={[]}
          />
        </div>
      </div>

      {/* Tab content */}
      {topTab === "care" && (
        <div className="reception-card reception-card--content">
          <Table
            columns={careColumns}
            dataSource={careRows}
            loading={careLoading}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
              showTotal: (total, range) => `Hiển thị ${range[0]}–${range[1]} trên ${total} khách`,
            }}
            locale={{ emptyText: "Không có dữ liệu" }}
            size="middle"
          />
        </div>
      )}

      {topTab === "grouping" && <CskhGroupingPanel />}
    </div>
  );
}

interface CskhGroup {
  id: string;
  name: string;
  criteria: string;
  patientCount: number;
  status: "active" | "inactive";
  createdAt: string;
}

const SYNTHETIC_GROUPS: CskhGroup[] = [
  { id: "g1", name: "Sau điều trị Implant", criteria: "Bệnh nhân hoàn thành Implant trong 30 ngày",        patientCount: 0, status: "active",   createdAt: "20/08/2026" },
  { id: "g2", name: "Sinh nhật tháng này",  criteria: "Bệnh nhân có sinh nhật trong tháng hiện tại",       patientCount: 0, status: "active",   createdAt: "01/08/2026" },
  { id: "g3", name: "Tái khám định kỳ",     criteria: "Bệnh nhân chưa tái khám sau 6 tháng",               patientCount: 0, status: "active",   createdAt: "15/07/2026" },
  { id: "g4", name: "Khách hàng VIP",       criteria: "Tổng chi tiêu >= 10.000.000 đ",                     patientCount: 0, status: "active",   createdAt: "01/06/2026" },
  { id: "g5", name: "Nhắc niềng răng",      criteria: "Bệnh nhân chỉnh nha chưa đến hẹn điều chỉnh",      patientCount: 0, status: "inactive", createdAt: "10/05/2026" },
];

function CskhGroupingPanel() {
  const [keyword, setKeyword] = useState("");

  const filtered = SYNTHETIC_GROUPS.filter((g) =>
    g.name.toLowerCase().includes(keyword.toLowerCase()),
  );

  const columns = [
    { title: "Tên nhóm", dataIndex: "name", key: "name", width: 220, render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { title: "Tiêu chí phân nhóm", dataIndex: "criteria", key: "criteria" },
    { title: "Số khách", dataIndex: "patientCount", key: "patientCount", width: 100, align: "right" as const },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (v: string) => (
        <Tag color={v === "active" ? "green" : "default"}>{v === "active" ? "Đang dùng" : "Tạm dừng"}</Tag>
      ),
    },
    { title: "Ngày tạo", dataIndex: "createdAt", key: "createdAt", width: 120 },
    {
      title: "Thao tác",
      key: "actions",
      width: 140,
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small">Chỉnh sửa</Button>
          <Button size="small" danger>Xóa</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm nhóm CSKH..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary" style={{ marginLeft: "auto" }}>Tạo nhóm mới</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table<CskhGroup>
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 20, showTotal: (total) => `${total} nhóm` }}
          locale={{ emptyText: "Chưa có nhóm CSKH nào" }}
        />
      </div>
    </>
  );
}
