import { useState } from "react";
import { Table, Input, Select, Tag, DatePicker, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useAuditLogList, type AuditLogDto } from "../api";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

const HTTP_METHOD_COLORS: Record<string, string> = {
  GET: "blue",
  POST: "green",
  PUT: "orange",
  PATCH: "cyan",
  DELETE: "red",
};

const { RangePicker } = DatePicker;

export function AuditLogPage() {
  const [userName, setUserName] = useState("");
  const [httpMethod, setHttpMethod] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const { data, isLoading } = useAuditLogList({
    userName: userName || undefined,
    httpMethod: httpMethod || undefined,
    startTime: dateRange?.[0]?.toISOString(),
    endTime: dateRange?.[1]?.toISOString(),
  });

  const statusColor = (code?: number) => {
    if (!code) return "default";
    if (code < 300) return "green";
    if (code < 400) return "blue";
    if (code < 500) return "orange";
    return "red";
  };

  const columns: ColumnsType<AuditLogDto> = [
    {
      title: t("AuditLog:Time"),
      dataIndex: "executionTime",
      key: "executionTime",
      width: 160,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY HH:mm:ss"),
    },
    {
      title: t("AuditLog:User"),
      dataIndex: "userName",
      key: "userName",
      width: 140,
      render: (v: string) => v ?? "—",
    },
    {
      title: t("AuditLog:Method"),
      dataIndex: "httpMethod",
      key: "httpMethod",
      width: 100,
      render: (v: string) => v ? <Tag color={HTTP_METHOD_COLORS[v] ?? "default"}>{v}</Tag> : "—",
    },
    {
      title: t("URL"),
      dataIndex: "url",
      key: "url",
      ellipsis: true,
      render: (v: string) => (
        <span style={{ fontFamily: "monospace", fontSize: 12 }}>{v ?? "—"}</span>
      ),
    },
    {
      title: t("HTTP Status"),
      dataIndex: "httpStatusCode",
      key: "httpStatusCode",
      width: 110,
      render: (v: number) => v ? <Tag color={statusColor(v)}>{v}</Tag> : "—",
    },
    {
      title: t("AuditLog:Duration"),
      dataIndex: "executionDuration",
      key: "executionDuration",
      width: 130,
      render: (v: number) => `${v} ms`,
    },
    {
      title: "IP",
      dataIndex: "clientIpAddress",
      key: "clientIpAddress",
      width: 130,
      render: (v: string) => v ?? "—",
    },
    {
      title: t("AuditLog:Error"),
      dataIndex: "exceptions",
      key: "exceptions",
      width: 80,
      render: (v: string) => v ? <Tag color="red">{t("AuditLog:HasError")}</Tag> : <Tag color="green">OK</Tag>,
    },
  ];

  return (
    <div className="reception-page">
      <PageHeader
        title={t("AuditLog:PageTitle")}
        subtitle={t("AuditLog:PageSubtitle")}
      />

      <div className="reception-card reception-card--toolbar">
        <div style={{ fontWeight: 700, fontSize: 18, color: "var(--bd-ink)", marginBottom: 4 }}>
          {t("AuditLog:SectionTitle")}
        </div>
        <div style={{ fontSize: 13, color: "var(--bd-muted)" }}>
          {t("AuditLog:SectionSubtitle")}
        </div>
      </div>
      <div className="reception-card reception-card--toolbar">
        <Space wrap>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("AuditLog:UserPlaceholder")}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder={t("AuditLog:MethodPlaceholder")}
            allowClear
            style={{ width: 160 }}
            value={httpMethod}
            onChange={setHttpMethod}
            options={["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({ value: m, label: m }))}
          />
          <RangePicker
            format="DD/MM/YYYY"
            onChange={(vals) => setDateRange(vals as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
          />
        </Space>
      </div>
      <div className="reception-card reception-card--content">
        <Table<AuditLogDto>
          rowKey="id"
          dataSource={data?.items ?? []}
          columns={columns}
          loading={isLoading}
          pagination={{ pageSize: 50, showTotal: (total) => t("AuditLog:RecordCount", total) }}
          locale={{ emptyText: t("AuditLog:NoData") }}
          size="small"
          scroll={{ x: 1100 }}
        />
      </div>
    </div>
  );
}
