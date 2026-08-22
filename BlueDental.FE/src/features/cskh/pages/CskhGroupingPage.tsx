import { useState } from "react";
import { Button, Input, Select, Table, Tag } from "antd";
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
type CareType =
  | "after-treatment"
  | "birthday"
  | "appointment-reminder"
  | "periodic"
  | "special";

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

const CARE_TYPES: { key: CareType; label: string }[] = [
  { key: "after-treatment", label: "Sau điều trị" },
  { key: "birthday", label: "Chúc mừng sinh nhật" },
  { key: "appointment-reminder", label: "Nhắc lịch hẹn" },
  { key: "periodic", label: "CSKH định kì" },
  { key: "special", label: "CSKH đặc biệt" },
];

const TABLE_COLUMNS = [
  {
    title: "Ngày chăm sóc",
    dataIndex: "careDate",
    key: "careDate",
  },
  {
    title: "Họ và tên",
    dataIndex: "fullName",
    key: "fullName",
  },
  {
    title: "Số điện thoại",
    dataIndex: "phone",
    key: "phone",
  },
  {
    title: "Bác sĩ điều trị",
    dataIndex: "doctor",
    key: "doctor",
  },
  {
    title: "Lịch hẹn sắp tới",
    dataIndex: "upcomingAppointment",
    key: "upcomingAppointment",
  },
  {
    title: "Trạng thái",
    dataIndex: "status",
    key: "status",
    render: (status: string | undefined) =>
      status ? <Tag>{status}</Tag> : null,
  },
  {
    title: "Ghi chú",
    dataIndex: "note",
    key: "note",
  },
  {
    title: "Thao tác",
    key: "actions",
    render: () => (
      <Button size="small" type="link">
        Chi tiết
      </Button>
    ),
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export function CskhGroupingPage() {
  const [topTab, setTopTab] = useState<TopTab>("care");
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("total");
  const [careType, setCareType] = useState<CareType>("after-treatment");
  const [keyword, setKeyword] = useState("");

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
              {sf.count} {sf.label}
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
          <Button icon={<DownloadOutlined />}>Xuất Excel</Button>
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

      {/* Table */}
      <div className="reception-card reception-card--content">
        <Table
          columns={TABLE_COLUMNS}
          dataSource={[]}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
            showTotal: (total) => `Hiển thị 0 trên ${total} khách`,
          }}
          locale={{ emptyText: "Không có dữ liệu" }}
          size="middle"
        />
      </div>
    </div>
  );
}
