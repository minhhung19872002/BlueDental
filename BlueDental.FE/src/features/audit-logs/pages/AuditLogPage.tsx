import { useState } from "react";
import { Table, Input, Select, Tag, DatePicker, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useAuditLogList, type AuditLogDto } from "../api";

const HTTP_METHOD_COLORS: Record<string, string> = {
  GET: "blue",
  POST: "green",
  PUT: "orange",
  PATCH: "cyan",
  DELETE: "red",
};

const { RangePicker } = DatePicker;

export function AuditLogPage() {
  const { t } = useTranslation();
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
      title: t("auditLog.colTime"),
      dataIndex: "executionTime",
      key: "executionTime",
      width: 160,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY HH:mm:ss"),
    },
    {
      title: t("auditLog.colUser"),
      dataIndex: "userName",
      key: "userName",
      width: 140,
      render: (v: string) => v ?? "—",
    },
    {
      title: t("auditLog.colMethod"),
      dataIndex: "httpMethod",
      key: "httpMethod",
      width: 100,
      render: (v: string) => v ? <Tag color={HTTP_METHOD_COLORS[v] ?? "default"}>{v}</Tag> : "—",
    },
    {
      title: "URL",
      dataIndex: "url",
      key: "url",
      ellipsis: true,
      render: (v: string) => (
        <span style={{ fontFamily: "monospace", fontSize: 12 }}>{v ?? "—"}</span>
      ),
    },
    {
      title: "HTTP Status",
      dataIndex: "httpStatusCode",
      key: "httpStatusCode",
      width: 110,
      render: (v: number) => v ? <Tag color={statusColor(v)}>{v}</Tag> : "—",
    },
    {
      title: t("auditLog.colDuration"),
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
      title: t("auditLog.colError"),
      dataIndex: "exceptions",
      key: "exceptions",
      width: 80,
      render: (v: string) => v ? <Tag color="red">{t("auditLog.hasError")}</Tag> : <Tag color="green">OK</Tag>,
    },
  ];

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--toolbar">
        <div style={{ fontWeight: 700, fontSize: 18, color: "#1B2A41", marginBottom: 4 }}>
          {t("auditLog.pageTitle")}
        </div>
        <div style={{ fontSize: 13, color: "#5A6B82" }}>
          {t("auditLog.pageSubtitle")}
        </div>
      </div>
      <div className="reception-card reception-card--toolbar">
        <Space wrap>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("auditLog.searchPlaceholder")}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder={t("auditLog.methodPlaceholder")}
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
          pagination={{ pageSize: 50, showTotal: (total) => t("auditLog.showTotal", { total }) }}
          locale={{ emptyText: t("auditLog.emptyText") }}
          size="small"
          scroll={{ x: 1100 }}
        />
      </div>
    </div>
  );
}
