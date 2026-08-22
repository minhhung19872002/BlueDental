import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, Row, Col, Button, Select, Segmented, Spin, Table, Typography, Tag } from "antd";
import { DownloadOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { formatVND } from "@/utils/format";
import { useReportSummary, useRevenueReport } from "@/features/reporting/api/index";

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


const CASHFLOW_TYPES = [
  { key: "all", label: "Tất cả" },
  { key: "thu", label: "Thu" },
  { key: "chi", label: "Chi" },
];

const CASHFLOW_COLUMNS = [
  { title: "Ngày", dataIndex: "date", key: "date", width: 110 },
  { title: "Loại", dataIndex: "type", key: "type", width: 80,
    render: (v: string) => <Tag color={v === "Thu" ? "green" : "red"}>{v}</Tag> },
  { title: "Danh mục", dataIndex: "category", key: "category", width: 160 },
  { title: "Nội dung", dataIndex: "description", key: "description" },
  { title: "Số tiền", dataIndex: "amount", key: "amount", width: 140, align: "right" as const,
    render: (v: number, r: { type: string }) => (
      <Text style={{ color: r.type === "Thu" ? "#10B981" : "#EF4444", fontVariantNumeric: "tabular-nums" }}>
        {r.type === "Thu" ? "+" : "-"}{formatVND(v ?? 0)} đ
      </Text>
    ) },
  { title: "Phương thức", dataIndex: "method", key: "method", width: 130 },
  { title: "Người thực hiện", dataIndex: "performer", key: "performer", width: 160 },
  { title: "Ghi chú", dataIndex: "note", key: "note", width: 140 },
];

const RESULT_COLUMNS = [
  { title: "Danh mục", dataIndex: "category", key: "category" },
  { title: "Doanh thu", dataIndex: "revenue", key: "revenue", width: 160, align: "right" as const,
    render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
  { title: "Chi phí", dataIndex: "expense", key: "expense", width: 160, align: "right" as const,
    render: (v: number) => <Text style={{ color: "#EF4444", fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
  { title: "Lợi nhuận", dataIndex: "profit", key: "profit", width: 160, align: "right" as const,
    render: (v: number) => <Text style={{ color: "#10B981", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
  { title: "Tỷ lệ LN (%)", dataIndex: "margin", key: "margin", width: 120, align: "right" as const,
    render: (v: number) => <Text style={{ color: v >= 0 ? "#10B981" : "#EF4444" }}>{v ?? 0}%</Text> },
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
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") ?? "expense";
  const dateMode = (searchParams.get("dateMode") as DateMode) ?? "day";
  const currentDate = dayjs(searchParams.get("date") ?? undefined);
  const [subFilter, setSubFilter] = useState("service");

  const startDate = currentDate.startOf(dateMode === "day" ? "day" : dateMode === "week" ? "week" : dateMode === "month" ? "month" : "year").format("YYYY-MM-DD");
  const endDate = currentDate.endOf(dateMode === "day" ? "day" : dateMode === "week" ? "week" : dateMode === "month" ? "month" : "year").format("YYYY-MM-DD");

  const { data: summary, isLoading: summaryLoading } = useReportSummary({ startDate, endDate });
  const { data: revenueData } = useRevenueReport({ startDate, endDate });

  const setActiveTab = (tab: string) => {
    setSearchParams((p) => { p.set("tab", tab); return p; });
  };
  const setDateMode = (mode: DateMode) => {
    setSearchParams((p) => { p.set("dateMode", mode); return p; });
  };
  const setCurrentDate = (updater: (d: Dayjs) => Dayjs) => {
    setSearchParams((p) => {
      const next = updater(dayjs(p.get("date") ?? undefined));
      p.set("date", next.format("YYYY-MM-DD"));
      return p;
    });
  };

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
              {summaryLoading ? <Spin size="small" /> : (
                <span style={{ fontWeight: 700, fontSize: 18, color: "#1B2A41" }}>
                  {formatVND(Array.isArray(revenueData) ? revenueData.reduce((s, d) => s + d.totalRevenue, 0) : 0)} đ
                </span>
              )}
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
            <Col xs={24} sm={12} md={6}>
              <div className="reception-card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 10 }}>Thông tin lượt khách</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#5A6B82" }}>Lượt khách</span>
                  <span style={{ fontWeight: 600 }}>{summaryLoading ? "…" : (summary?.totalPatients ?? 0)} lượt</span>
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="reception-card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 10 }}>Thông tin lịch hẹn</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#5A6B82" }}>Lịch hẹn</span>
                  <span style={{ fontWeight: 600 }}>{summaryLoading ? "…" : (summary?.totalAppointments ?? 0)} lịch hẹn</span>
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="reception-card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 10 }}>Thông tin thanh toán</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#5A6B82" }}>Doanh thu</span>
                  <span style={{ fontWeight: 600, color: "#10B981" }}>
                    {summaryLoading ? "…" : formatVND(summary?.totalRevenue ?? 0)} đ
                  </span>
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="reception-card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 10 }}>TB doanh thu / KH</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#5A6B82" }}>Trung bình</span>
                  <span style={{ fontWeight: 600 }}>
                    {summaryLoading ? "…" : formatVND(summary?.avgRevenuePerPatient ?? 0)} đ
                  </span>
                </div>
              </div>
            </Col>
          </Row>
        </>
      )}

      {activeTab === "cashflow" && <CashflowTab />}
      {activeTab === "result" && <BusinessResultTab />}
      {activeTab === "cashflow-v2" && <CashflowV2Tab />}
    </div>
  );
}

function CashflowTab() {
  const [typeFilter, setTypeFilter] = useState("all");

  const summaryCards = [
    { label: "Tổng thu", value: 0, color: "#10B981" },
    { label: "Tổng chi", value: 0, color: "#EF4444" },
    { label: "Lợi nhuận ước tính", value: 0, color: "#1E70E6" },
  ];

  return (
    <>
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {CASHFLOW_TYPES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setTypeFilter(f.key)}
              style={{
                padding: "8px 14px", border: "none",
                borderBottom: typeFilter === f.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: typeFilter === f.key ? "#1677ff" : "#595959",
                fontWeight: typeFilter === f.key ? 600 : 400,
                cursor: "pointer", fontSize: 13, whiteSpace: "nowrap",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Row gutter={[12, 12]} style={{ margin: "12px 0" }}>
        {summaryCards.map((c) => (
          <Col key={c.label} xs={24} sm={8}>
            <div className="reception-card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontVariantNumeric: "tabular-nums" }}>
                {formatVND(c.value)} đ
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center" }}>
          <Button icon={<DownloadOutlined />} style={{ marginLeft: "auto" }}>Xuất Excel</Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <Table
          size="small"
          rowKey="id"
          columns={CASHFLOW_COLUMNS}
          dataSource={[]}
          pagination={{
            pageSize: 20,
            showTotal: (total, range) => `Hiển thị ${range[0]}–${range[1]} trên ${total} dòng`,
          }}
          locale={{ emptyText: "Không có dữ liệu" }}
        />
      </div>
    </>
  );
}

const CF_V2_SECTIONS = [
  {
    key: "operating",
    label: "I. Dòng tiền từ hoạt động kinh doanh",
    items: [
      { label: "Thu từ dịch vụ y tế", value: 0 },
      { label: "Chi phí vật tư, thuốc", value: 0 },
      { label: "Chi phí nhân sự", value: 0 },
      { label: "Chi phí quản lý", value: 0 },
    ],
  },
  {
    key: "investing",
    label: "II. Dòng tiền từ hoạt động đầu tư",
    items: [
      { label: "Mua thiết bị y tế", value: 0 },
      { label: "Sửa chữa, nâng cấp", value: 0 },
    ],
  },
  {
    key: "financing",
    label: "III. Dòng tiền từ hoạt động tài chính",
    items: [
      { label: "Vay vốn ngân hàng", value: 0 },
      { label: "Trả nợ vay", value: 0 },
    ],
  },
];

function CashflowV2Tab() {
  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button icon={<DownloadOutlined />}>Xuất Excel</Button>
        </div>
      </div>

      {CF_V2_SECTIONS.map((section) => (
        <div key={section.key} className="reception-card" style={{ marginBottom: 12, padding: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1B2A41", marginBottom: 12 }}>
            {section.label}
          </div>
          {section.items.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid #F3F4F6",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#5A6B82" }}>{item.label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                {formatVND(item.value)} đ
              </span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontWeight: 700 }}>
            <span>Dòng tiền thuần</span>
            <span style={{ color: "#1677ff" }}>0 đ</span>
          </div>
        </div>
      ))}

      <div className="reception-card" style={{ padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}>
          <span style={{ color: "#1B2A41" }}>TỔNG DÒNG TIỀN THUẦN</span>
          <span style={{ color: "#1677ff" }}>0 đ</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13, color: "#5A6B82" }}>
          <span>Số dư đầu kỳ</span>
          <span>0 đ</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 13, color: "#1B2A41", fontWeight: 600 }}>
          <span>Số dư cuối kỳ</span>
          <span>0 đ</span>
        </div>
      </div>
    </>
  );
}

function BusinessResultTab() {
  const resultSummary = [
    { label: "Doanh thu", value: 0, color: "#1E70E6" },
    { label: "Chi phí", value: 0, color: "#EF4444" },
    { label: "Lợi nhuận", value: 0, color: "#10B981" },
    { label: "Tỷ lệ lợi nhuận", value: "0%", color: "#F59E0B" },
  ];

  return (
    <>
      <Row gutter={[12, 12]} style={{ margin: "12px 0" }}>
        {resultSummary.map((c) => (
          <Col key={c.label} xs={24} sm={12} md={6}>
            <div className="reception-card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontVariantNumeric: "tabular-nums" }}>
                {typeof c.value === "number" ? `${formatVND(c.value)} đ` : c.value}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center" }}>
          <Button icon={<DownloadOutlined />} style={{ marginLeft: "auto" }}>Xuất Excel</Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <Table
          size="small"
          rowKey="category"
          columns={RESULT_COLUMNS}
          dataSource={[]}
          pagination={false}
          locale={{ emptyText: "Không có dữ liệu" }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><Text strong>Tổng</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right"><Text strong style={{ fontVariantNumeric: "tabular-nums" }}>0 đ</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><Text strong style={{ color: "#EF4444", fontVariantNumeric: "tabular-nums" }}>0 đ</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right"><Text strong style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>0 đ</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right"><Text strong>0%</Text></Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </div>
    </>
  );
}
