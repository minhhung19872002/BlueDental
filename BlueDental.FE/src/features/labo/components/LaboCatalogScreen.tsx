import { useState } from "react";
import { Button, Input, Tooltip } from "antd";
import { toast } from "sonner";
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  useLaboCatalogCommands,
  useLaboCatalogList,
  type LaboCatalogItem,
} from "../api/laboCatalogListApi";
import { LaboCatalogDialog } from "./LaboCatalogDialog";
import type { LaboTab } from "../laboTabs";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { formatDateTime } from "@/utils/format";

/**
 * Khớp cắn Labo, Đường hoàn tất and Kiểu nhịp Labo.
 *
 * One screen for all three: the reference builds them from the same component
 * with only the catalog's label and noun changing, so this does too rather
 * than repeating a table and a dialog three times.
 */
interface LaboCatalogScreenProps {
  tab: LaboTab;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

export function LaboCatalogScreen({ tab, canCreate, canUpdate, canDelete }: LaboCatalogScreenProps) {
  const group = tab.group as string;
  const noun = tab.noun as string;

  const [keyword, setKeyword] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; item: LaboCatalogItem | null }>({
    open: false,
    item: null,
  });
  const [pendingDelete, setPendingDelete] = useState<LaboCatalogItem | null>(null);

  const pagination = useTablePagination(20);
  const debouncedKeyword = useDebounce(keyword, 400);

  const query = useLaboCatalogList(group, {
    filter: debouncedKeyword,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const { remove } = useLaboCatalogCommands(group);

  const totalCount = query.data?.totalCount ?? 0;

  const handleSearch = (value: string) => {
    // A narrowed list has fewer pages; staying on page 4 would show nothing.
    setKeyword(value.slice(0, 100));
    pagination.resetToFirstPage();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      await remove.mutateAsync(pendingDelete.id);
      toast.success(t("Common:Deleted"));
      setPendingDelete(null);
    } catch {
      // queryClient reports the failure; the dialog stays open to retry.
    }
  };

  const columns: ColumnsType<LaboCatalogItem> = [
    {
      key: "name",
      title: tab.label,
      render: (_, row) => (
        <p className="bd-cat-name">{row.name}</p>
      ),
    },
    {
      key: "updatedAt",
      title: t("Common:LastUpdated"),
      width: 280,
      render: (_, row) => (
        <span className="bd-cat-num">
          {formatDateTime(row.lastModificationTime ?? row.creationTime)}
        </span>
      ),
    },
    ...(canUpdate || canDelete
      ? [
          {
            key: "actions",
            title: t("Common:Actions"),
            width: 100,
            align: "center" as const,
            fixed: "right" as const,
            render: (_: unknown, row: LaboCatalogItem) => (
              <div className="bd-cat-rowactions">
                {canUpdate && (
                  <Tooltip title={t("Common:Edit")}>
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      aria-label={t("Common:EditAriaLabel", row.name)}
                      onClick={() => setDialog({ open: true, item: row })}
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
                      aria-label={t("Common:DeleteAriaLabel", row.name)}
                      onClick={() => setPendingDelete(row)}
                    />
                  </Tooltip>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="bd-labo-screen">
      <div className="bd-labo-header">
        <Input
          className="bd-labo-search"
          prefix={<SearchOutlined />}
          placeholder={t("Common:SearchItem", noun)}
          aria-label={t("Common:SearchItem", noun)}
          value={keyword}
          maxLength={100}
          allowClear
          onChange={(event) => handleSearch(event.target.value)}
        />

        {canCreate && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setDialog({ open: true, item: null })}
          >
            {t("Common:CreateItem", noun)}
          </Button>
        )}
      </div>

      <div className="bd-cat-body">
        <div className="bd-cat-card">
          <DataTable<LaboCatalogItem>
            columns={columns}
            dataSource={query.data?.items ?? []}
            rowKey="id"
            loading={query.isFetching}
            locale={{
              emptyText: debouncedKeyword
                ? t("Common:NoResultsMatch")
                : t("Common:NoResultsFor2", tab.label.toLowerCase()),
            }}
            pagination={pagination.buildConfig(totalCount, countedTotal(noun))}
          />
        </div>
      </div>

      <LaboCatalogDialog
        open={dialog.open}
        group={group}
        noun={noun}
        item={dialog.item}
        onClose={() => setDialog({ open: false, item: null })}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={noun}
        name={pendingDelete?.name ?? ""}
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
