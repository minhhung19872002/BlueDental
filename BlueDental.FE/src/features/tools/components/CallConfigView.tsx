import { useMemo, useState } from "react";
import { Button, Input, Tag, Tooltip } from "antd";
import { toast } from "sonner";
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  useCallConfigurations,
  useDeleteCallConfiguration,
  type CallConfigurationDto,
} from "../api/toolsApi";
import { CallConfigDialog } from "./CallConfigDialog";
import { activeTag, providerLabel } from "./callCatalog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { pagerTotal } from "@/utils/pagerTotal";

interface CallConfigViewProps {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

/** Cấu Hình — the PBX configurations, as the reference lists them. */
export function CallConfigView({ canCreate, canUpdate, canDelete }: CallConfigViewProps) {
  const [keyword, setKeyword] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; config: CallConfigurationDto | null }>({
    open: false,
    config: null,
  });
  const [pendingDelete, setPendingDelete] = useState<CallConfigurationDto | null>(null);

  const pagination = useTablePagination();
  const debouncedKeyword = useDebounce(keyword, 300);

  const { data, isFetching } = useCallConfigurations({
    filter: debouncedKeyword.trim() || undefined,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const deleteConfig = useDeleteCallConfiguration();

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteConfig.mutateAsync(pendingDelete.id);
      toast.success(t("Tools:ConfigDeleted"));
    } catch {
      // queryClient reports the failure; nothing to add here.
    } finally {
      setPendingDelete(null);
    }
  };

  const columns = useMemo<ColumnsType<CallConfigurationDto>>(
    () => [
      {
        key: "name",
        title: t("Tools:NameLabel"),
        render: (_, config) => <span className="bd-cat-medium">{config.name}</span>,
      },
      { key: "branch", title: t("Tools:BranchLabel"), dataIndex: "branchName" },
      {
        key: "settingKind",
        title: t("Tools:SettingTypeLabel"),
        // UNKNOWN_REFERENCE_BEHAVIOR: the reference's table was empty, so what
        // this column holds could not be read.
        render: () => "—",
      },
      {
        key: "provider",
        title: t("Tools:ProviderLabel"),
        render: (_, config) => providerLabel(config.provider),
      },
      {
        key: "status",
        title: t("Tools:StatusLabel"),
        width: 130,
        render: (_, config) => {
          const { label, color } = activeTag(config.isActive);
          return <Tag color={color}>{label}</Tag>;
        },
      },
      {
        key: "actions",
        title: t("Tools:ActionsLabel"),
        width: 110,
        align: "center",
        fixed: "right",
        render: (_, config) => (
          <div className="bd-cat-rowactions">
            {canUpdate && (
              <Tooltip title={t("Common:Edit")}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  aria-label={t("Tools:EditConfigAria", config.name)}
                  onClick={() => setDialog({ open: true, config })}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title={t("Common:Delete")}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={t("Tools:DeleteConfigAria", config.name)}
                  onClick={() => setPendingDelete(config)}
                />
              </Tooltip>
            )}
          </div>
        ),
      },
    ],
    [canUpdate, canDelete],
  );

  return (
    <div className="reception-card reception-card--content">
      <div className="bd-ops-toolbar">
        <Input
          className="bd-ops-search"
          prefix={<SearchOutlined />}
          placeholder={t("Tools:SearchPlaceholder")}
          aria-label={t("Tools:SearchPlaceholder")}
          value={keyword}
          allowClear
          onChange={(event) => {
            setKeyword(event.target.value);
            pagination.resetToFirstPage();
          }}
        />
        {canCreate && (
          <Button
            className="bd-tools-toolbar-end"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setDialog({ open: true, config: null })}
          >
            {t("Tools:CreateConfig")}
          </Button>
        )}
      </div>

      <DataTable<CallConfigurationDto>
        columns={columns}
        dataSource={data?.items ?? []}
        rowKey="id"
        loading={isFetching}
        pagination={pagination.buildConfig(data?.totalCount, pagerTotal)}
        locale={{ emptyText: t("Tools:NoConfigs") }}
      />

      <CallConfigDialog
        open={dialog.open}
        config={dialog.config}
        onClose={() => setDialog({ open: false, config: null })}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("Tools:ConfigNoun")}
        name={pendingDelete?.name ?? ""}
        pending={deleteConfig.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

