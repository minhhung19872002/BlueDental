import { useMemo, useState } from "react";
import { Button, Tag } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnsType } from "antd/es/table";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { formatDate } from "@/utils/format";
import { useZaloStatus, useZaloTemplates, zaloKeys, type ZaloTemplateDto } from "../api/zaloApi";

/** The reference's pager on this list runs 5…100 with 20 selected. */
const PAGE_SIZE_OPTIONS = [5, 10, 20, 25, 50, 100];

/** Zalo's own template states, coloured the way its manager shows them. */
const TEMPLATE_STATUS: Record<string, { color: string; label: string }> = {
  ENABLE: { color: "green", label: "Tools:ZaloTemplateEnabled" },
  PENDING_REVIEW: { color: "gold", label: "Tools:ZaloTemplatePending" },
  REJECT: { color: "red", label: "Tools:ZaloTemplateRejected" },
  DISABLE: { color: "default", label: "Tools:ZaloTemplateDisabled" },
};

function templateStatusTag(status: string | null) {
  const found = status ? TEMPLATE_STATUS[status.toUpperCase()] : undefined;
  return found ? { color: found.color, label: t(found.label) } : { color: "default", label: status ?? "—" };
}

function templateTotal(total: number, range: [number, number]) {
  return total === 0
    ? t("Tools:ZaloTemplatePagerZero")
    : t("Tools:ZaloTemplatePagerRange", range[0], range[1], total);
}

/** Mẫu ZBS — read straight from Zalo; nothing here is created or edited. */
export function ZaloTemplateView() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const pagination = useTablePagination(20, { pageSizeOptions: PAGE_SIZE_OPTIONS });

  const { data: statusData } = useZaloStatus();
  const isConnected = statusData?.isConnected ?? false;

  const { data, isFetching, error } = useZaloTemplates(
    { skipCount: pagination.skipCount, maxResultCount: pagination.maxResultCount },
    isConnected,
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: [...zaloKeys.all, "templates"] });
    setRefreshing(false);
  };

  const columns = useMemo<ColumnsType<ZaloTemplateDto>>(
    () => [
      { key: "name", title: t("Tools:ZaloTemplateName"), dataIndex: "name" },
      { key: "templateId", title: t("Tools:ZaloTemplateId"), dataIndex: "templateId", width: 180 },
      {
        key: "status",
        title: t("Tools:StatusLabel"),
        width: 150,
        render: (_, tpl) => {
          const { color, label } = templateStatusTag(tpl.status);
          return <Tag color={color}>{label}</Tag>;
        },
      },
      { key: "quality", title: t("Tools:ZaloTemplateQuality"), width: 140, render: (_, tpl) => tpl.quality ?? "—" },
      {
        key: "listParams",
        title: t("Tools:ZaloTemplateParams"),
        width: 200,
        render: (_, tpl) => tpl.listParams ?? "—",
      },
      { key: "created", title: t("Tools:CreatedAtLabel"), width: 130, render: (_, tpl) => formatDate(tpl.createdAt) },
    ],
    [],
  );

  const emptyText = error ? extractApiError(error) : t("Tools:NoZaloTemplates");

  return (
    <div className="reception-card reception-card--content">
      <div className="bd-ops-toolbar">
        <p className="bd-zalo-hint bd-zalo-hint--list">{t("Tools:ZaloTemplateHint")}</p>
        <Button
          className="bd-tools-toolbar-end"
          icon={<ReloadOutlined />}
          loading={refreshing || isFetching}
          onClick={handleRefresh}
        >
          {t("Common:Refresh")}
        </Button>
      </div>
      <DataTable<ZaloTemplateDto>
        columns={columns}
        dataSource={data?.items ?? []}
        rowKey="templateId"
        loading={isFetching}
        pagination={pagination.buildConfig(data?.totalCount, templateTotal)}
        locale={{ emptyText }}
      />
    </div>
  );
}
