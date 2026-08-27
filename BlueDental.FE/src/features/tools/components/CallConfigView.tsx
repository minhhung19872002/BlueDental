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

/** Cấu Hình — the PBX configurations, as the reference lists them. */
export function CallConfigView() {
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
      toast.success(t("Đã xoá cấu hình"));
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
        title: t("Tên"),
        render: (_, config) => <span className="bd-cat-medium">{config.name}</span>,
      },
      { key: "branch", title: t("Chi nhánh"), dataIndex: "branchName" },
      {
        key: "settingKind",
        title: t("Loại cài đặt"),
        // UNKNOWN_REFERENCE_BEHAVIOR: the reference's table was empty, so what
        // this column holds could not be read.
        render: () => "—",
      },
      {
        key: "provider",
        title: t("Nhà cung cấp"),
        render: (_, config) => providerLabel(config.provider),
      },
      {
        key: "status",
        title: t("Trạng thái"),
        width: 130,
        render: (_, config) => {
          const { label, color } = activeTag(config.isActive);
          return <Tag color={color}>{label}</Tag>;
        },
      },
      {
        key: "actions",
        title: t("Thao tác"),
        width: 110,
        align: "center",
        render: (_, config) => (
          <div className="bd-cat-rowactions">
            <Tooltip title={t("Chỉnh sửa")}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label={t("Chỉnh sửa {0}", config.name)}
                onClick={() => setDialog({ open: true, config })}
              />
            </Tooltip>
            <Tooltip title={t("Xoá")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t("Xoá {0}", config.name)}
                onClick={() => setPendingDelete(config)}
              />
            </Tooltip>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="reception-card reception-card--content">
      <div className="bd-ops-toolbar">
        <Input
          className="bd-ops-search"
          prefix={<SearchOutlined />}
          placeholder={t("Tìm kiếm")}
          aria-label={t("Tìm kiếm")}
          value={keyword}
          allowClear
          onChange={(event) => {
            setKeyword(event.target.value);
            pagination.resetToFirstPage();
          }}
        />
        <Button
          className="bd-tools-toolbar-end"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setDialog({ open: true, config: null })}
        >
          {t("Tạo cấu hình")}
        </Button>
      </div>

      <DataTable<CallConfigurationDto>
        columns={columns}
        dataSource={data?.items ?? []}
        rowKey="id"
        loading={isFetching}
        pagination={pagination.buildConfig(data?.totalCount, pagerTotal)}
        locale={{ emptyText: t("Chưa có cấu hình nào") }}
      />

      <CallConfigDialog
        open={dialog.open}
        config={dialog.config}
        onClose={() => setDialog({ open: false, config: null })}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("cấu hình")}
        name={pendingDelete?.name ?? ""}
        pending={deleteConfig.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
