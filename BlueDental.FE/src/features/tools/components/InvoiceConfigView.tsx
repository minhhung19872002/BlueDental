import { useMemo, useState } from "react";
import { Button, Input, Tag, Tooltip } from "antd";
import { toast } from "sonner";
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  useDeleteEInvoiceConfig,
  useEInvoiceConfigs,
  type EInvoiceConfigDto,
} from "../api/eInvoiceConfigApi";
import { activeTag } from "./callCatalog";
import { EInvoiceConfigDialog } from "./EInvoiceConfigDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { useClinicBranches } from "@/features/organizations/api";
import { t } from "@/lib/i18n";
import { pagerTotal } from "@/utils/pagerTotal";

interface InvoiceConfigViewProps {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

/** Cấu Hình — the EasyInvoice account each branch issues e-invoices under. */
export function InvoiceConfigView({ canCreate, canUpdate, canDelete }: InvoiceConfigViewProps) {
  const [keyword, setKeyword] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; config: EInvoiceConfigDto | null }>({
    open: false,
    config: null,
  });
  const [pendingDelete, setPendingDelete] = useState<EInvoiceConfigDto | null>(null);

  const { data, isFetching } = useEInvoiceConfigs();
  const { data: branches } = useClinicBranches(true);
  const deleteConfig = useDeleteEInvoiceConfig();

  const branchName = useMemo(() => {
    const names = new Map((branches ?? []).map((b) => [b.id, b.name]));
    return (id: string) => names.get(id) ?? "—";
  }, [branches]);

  // A handful of rows per clinic chain — filtering client-side is enough.
  const rows = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return data ?? [];
    return (data ?? []).filter((c) =>
      [c.name, c.provider, branchName(c.clinicBranchId)].some((v) =>
        v.toLowerCase().includes(needle),
      ),
    );
  }, [data, keyword, branchName]);

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    deleteConfig.mutate(pendingDelete.id, {
      onSuccess: () => toast.success(t("Tools:ConfigDeleted")),
      onSettled: () => setPendingDelete(null),
    });
  };

  const columns = useMemo<ColumnsType<EInvoiceConfigDto>>(
    () => [
      { key: "name", title: t("Tools:NameLabel"), dataIndex: "name" },
      { key: "branch", title: t("Tools:BranchNameCol"), render: (_, config) => branchName(config.clinicBranchId) },
      {
        key: "module",
        title: t("Tools:ModuleCol"),
        width: 120,
        render: () => <Tag color="blue">{t("Tools:InvoiceTab")}</Tag>,
      },
      {
        key: "provider",
        title: t("Tools:ProviderLabel"),
        width: 140,
        render: (_, config) => <Tag>{config.provider}</Tag>,
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
    [canUpdate, canDelete, branchName],
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
          onChange={(event) => setKeyword(event.target.value)}
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

      <DataTable<EInvoiceConfigDto>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={isFetching}
        pagination={{ total: rows.length, showTotal: pagerTotal }}
        locale={{ emptyText: t("Tools:NoConfigs") }}
      />

      <EInvoiceConfigDialog
        open={dialog.open}
        config={dialog.config}
        onClose={() => setDialog({ open: false, config: null })}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("Tools:ConfigNoun")}
        name={pendingDelete?.name ?? ""}
        pending={deleteConfig.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
