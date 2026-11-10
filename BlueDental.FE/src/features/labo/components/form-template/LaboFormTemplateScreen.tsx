import { useState } from "react";
import { Button, Input } from "antd";
import { toast } from "sonner";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import {
  useLaboFormTemplateCommands,
  useLaboFormTemplateList,
  type LaboFormTemplateDto,
} from "../../api/laboFormTemplateApi";
import { LaboFormTemplateDialog } from "./LaboFormTemplateDialog";
import { LaboFormTemplateTable } from "./LaboFormTemplateTable";
import "./form-template.css";

interface Props {
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

/**
 * Mẫu phiếu (F-93, the hybrid of labo.md §11.1): the branch's lists of extra
 * fields a Phiếu yêu cầu can take under Thông tin bổ sung. Only the Đang dùng
 * ones are offered on a slip; a slip that took one keeps its own copy, so
 * editing, stopping or deleting a template never changes a slip already made.
 */
export function LaboFormTemplateScreen({ canCreate, canUpdate, canDelete }: Props) {
  const [keyword, setKeyword] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; template: LaboFormTemplateDto | null }>({
    open: false,
    template: null,
  });
  const [pendingDelete, setPendingDelete] = useState<LaboFormTemplateDto | null>(null);

  const pagination = useTablePagination(20);
  const debouncedKeyword = useDebounce(keyword, 400);
  const query = useLaboFormTemplateList({
    filter: debouncedKeyword,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const { setActive, remove } = useLaboFormTemplateCommands();

  const handleSearch = (value: string) => {
    setKeyword(value.slice(0, 100));
    pagination.resetToFirstPage();
  };

  const handleToggleActive = async (row: LaboFormTemplateDto, isActive: boolean) => {
    try {
      await setActive.mutateAsync({ id: row.id, isActive });
      toast.success(t("Common:Updated"));
    } catch {
      // queryClient reports the failure; the switch stays where the server has it.
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync(pendingDelete.id);
      toast.success(t("Common:Deleted"));
      setPendingDelete(null);
    } catch {
      // queryClient reports the failure; the dialog stays open to retry.
    }
  };

  const noun = t("Labo:Noun:FormTemplate");
  const togglingId = setActive.isPending ? setActive.variables?.id : undefined;

  return (
    <div className="bd-labo-screen">
      <div className="bd-labo-header">
        <Input
          className="bd-labo-search"
          prefix={<SearchOutlined />}
          placeholder={t("Labo:FormTpl:Search")}
          aria-label={t("Labo:FormTpl:Search")}
          value={keyword}
          maxLength={100}
          allowClear
          onChange={(event) => handleSearch(event.target.value)}
        />
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialog({ open: true, template: null })}>
            {t("Common:CreateItem", noun)}
          </Button>
        )}
      </div>

      <p className="ft-intro">{t("Labo:FormTpl:Intro")}</p>

      <div className="bd-cat-body">
        <div className="bd-cat-card">
          <LaboFormTemplateTable
            rows={query.data?.items ?? []}
            loading={query.isFetching}
            emptyText={debouncedKeyword ? t("Common:NoResultsMatch") : t("Labo:FormTpl:Empty")}
            pagination={pagination.buildConfig(query.data?.totalCount ?? 0, countedTotal(noun))}
            togglingId={togglingId}
            onToggleActive={canUpdate ? (row, active) => void handleToggleActive(row, active) : undefined}
            onEdit={canUpdate ? (row) => setDialog({ open: true, template: row }) : undefined}
            onDelete={canDelete ? setPendingDelete : undefined}
          />
        </div>
      </div>

      <LaboFormTemplateDialog
        open={dialog.open}
        template={dialog.template}
        onClose={() => setDialog({ open: false, template: null })}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={noun}
        name={pendingDelete?.name ?? ""}
        pending={remove.isPending}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
