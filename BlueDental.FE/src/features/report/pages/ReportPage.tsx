import { useState } from "react";
import { Tabs, Row, Col, Button, Select, Segmented, Table, Typography } from "antd";
import { DownloadOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { formatVND } from "@/utils/format";

const { Text } = Typography;

type DateMode = "day" | "week" | "month" | "year";

const REPORT_TABS = [
  { key: "expense",    label: "Doanh số và lượt khách" },
  { key: "cashflow",   label: "Quản lý thu chi" },
  { key: "result",     label: "Kết quả kinh doanh" },
  { key: "cashflow-v2",label: "Luân chuyển dòng tiền V2" },
];

const SUB_FILTERS = [
  { key: "service",  label: "Khách hàng phát sinh dịch vụ" },
  { key: "payment",  label: "Thanh toán" },
  { key: "refund",   label: "Hoàn tiền" },
  { key: "debt",     label: "Dư nợ" },
];

const SUMMARY_CARDS = [
  { title: "Thông tin lượt khách",  metrics: [{ label: "Lượt khách hôm nay", value: 0, unit: "lượt khách" }] },
  { title: "Thông tin lịch hẹn",    metrics: [{ label: "Lịch hẹn hôm nay",   value: 0, unit: "lịch hẹn" }] },
  { title: "Thông tin thanh toán",  metrics: [{ label: "Doanh thu hôm nay",   value: 0, unit: "đ" }] },
  { title: "Thông tin thu chi",     metrics: [{ label: "Thu",                 value: 0, unit: "đ" }, { label: "Chi", value: 0, unit: "đ" }] },
];

const EXPENSE_COLUMNS = [
  { title: "Ngày", dataIndex: "date", key: "date", width: 110 },
  { title: "Tên khách hàng", dataIndex: "patientName", key: "patientName", width: 180 },
  { title: "Nhân sự tư vấn", dataIndex: "counselorName", key: "counselorName", width: 150 },
  { title: "Bác sĩ tiếp nhận", dataIndex: "doctorName", key: "doctorName", width: 150 },
  { title: "Dịch vụ điều trị", dataIndex: "serviceName", key: "serviceName" },
  { title: "Số lượng", dataIndex: "quantity", key: "quantity", width: 90, align: "right" as const },
  { title: "Thành tiền", dataIndex: "totalAmount", key: "totalAmount", width: 130, align: "right" as const, render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
  { title: "Đã thanh toán", dataIndex: "paidAmount", key: "paidAmount", width: 130, align: "right" as const, render: (v: number) => <Text style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
];

export function ReportPage() {
  const [activeTab, setActiveTab] = useState("expense");
  const [dateMode, setDateMode] = useState<DateMode>("day");
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [subFilter, setSubFilter] = useState("service");

  const navigateDate = (dir: 1 | -1) => {
    const unit = dateMode === "day" ? "day" : dateMode === "week" ? "week" : dateMode === "month" ? "month" : "year";
    setCurrentDate((d) => d.add(dir, unit));
  };

  const displayDate = () => {
    if (dateMode === "day") return currentDate.format("DD/MM/YYYY");
    if (dateMode === "week") return `${currentDate.startOf("week").format("DD/MM")} – ${currentDate.endOf("week").format("DD/MM/YYYY")}`;
    if (dateMode === "month") return currentDate.format("MM/YYYY");
    return currentDate.format("YYYY");
  };

  return (
    <div className="reception-page">
      {/* Main tab bar */}
      <div className="reception-card" style={{ padding: "0 16px" }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={REPORT_TABS.map((t) => ({ key: t.key, label: t.label }))}
        />
      </div>

      {/* Shared toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Segmented
            value={dateMode}
            onChange={(v) => setDateMode(v as DateMode)}
            options={[
              { label: "Ngày",  value: "day" },
              { label: "Tuần",  value: "week" },
              { label: "Tháng", value: "month" },
              { label: "Năm",   value: "year" },
            ]}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Button type="text" size="small" icon={<LeftOutlined />} onClick={() => navigateDate(-1)} />
            <span style={{ minWidth: 130, textAlign: "center", fontWeight: 600, fontSize: 14 }}>{displayDate()}</span>
            <Button type="text" size="small" icon={<RightOutlined />} onClick={() => navigateDate(1)} />
          </div>
          <Select placeholder="Bác sĩ điều trị" allowClear style={{ minWidth: 180 }} options={[]} />
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "expense" && (
        <>
          {/* Sub-filter pills */}
          <div className="reception-card reception-card--tabs">
            <div style={{ display: "flex", gap: 0 }}>
              {SUB_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setSubFilter(f.key)}
                  style={{
                    padding: "8px 14px", border: "none",
                    borderBottom: subFilter === f.key ? "2px solid #1677ff" : "2px solid transparent",
                    background: "none",
                    color: subFilter === f.key ? "#1677ff" : "#595959",
                    fontWeight: subFilter === f.key ? 600 : 400,
                    cursor: "pointer", fontSize: 13, whiteSpace: "nowrap",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick stats + export */}
          <div className="reception-card reception-card--toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 13, color: "#5A6B82" }}>Doanh số:</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: "#1B2A41" }}>0 đ</span>
              <Button icon={<DownloadOutlined />} style={{ marginLeft: "auto" }}>Xuất Excel</Button>
            </div>
          </div>

          {/* Table */}
          <div className="reception-card reception-card--content">
            <Table
              size="small"
              rowKey="id"
              columns={EXPENSE_COLUMNS}
              dataSource={[]}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                pageSizeOptions: ["5", "10", "20", "25", "50", "100"],
                showTotal: (total, range) => `Hiển thị ${range[0]}–${range[1]} trên ${total} dòng`,
              }}
              locale={{ emptyText: "Không có dữ liệu" }}
            />
          </div>

          {/* Summary cards */}
          <Row gutter={[12, 12]}>
            {SUMMARY_CARDS.map((card) => (
              <Col key={card.title} xs={24} sm={12} md={6}>
                <div className="reception-card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 10 }}>{card.title}</div>
                  {card.metrics.map((m) => (
                    <div key={m.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: "#5A6B82" }}>{m.label}</span>
                      <span style={{ fontWeight: 600, color: "#1B2A41" }}>{m.value.toLocaleString("vi-VN")} {m.unit}</span>
                    </div>
                  ))}
                </div>
              </Col>
            ))}
          </Row>
        </>
      )}

      {activeTab !== "expense" && (
        <div className="reception-card reception-card--content">
          <div style={{ padding: "48px 0", textAlign: "center", color: "#9CA3AF" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div style={{ fontWeight: 500, color: "#6B7280" }}>
              {REPORT_TABS.find((t) => t.key === activeTab)?.label}
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Nội dung đang được phát triển</div>
          </div>
        </div>
      )}
    </div>
  );
}
