import { useState } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { useCardCommands, useCardTypes } from "../api/prepaidCardApi";
import { useRunCommand } from "../hooks/useRunCommand";
import type { CardTypeDto, SaveCardTypeInput } from "../types";
import { CardTypeDialog } from "./CardTypeDialog";
import { cardTypeColumns } from "./cardTypeColumns";

/** Tab "Loại thẻ" — Khởi tạo thẻ (cụm 3 mục 1). */
export function CardTypePanel() {
  const ability = useAbility("prepaidCard");
  const { data: types = [], isLoading } = useCardTypes();
  const commands = useCardCommands();
  const run = useRunCommand();
  const [editing, setEditing] = useState<CardTypeDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<CardTypeDto | null>(null);

  const handleSave = async (input: SaveCardTypeInput) => {
    const saved =
      editing === "new"
        ? await run(() => commands.createType.mutateAsync(input), t("PrepaidCard:Type:Created"))
        : editing !== null &&
          (await run(() => commands.updateType.mutateAsync({ id: editing.id, input }), t("PrepaidCard:Type:Saved")));
    if (saved) setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    if (await run(() => commands.deleteType.mutateAsync(deleting.id), t("PrepaidCard:Type:Deleted"))) setDeleting(null);
  };

  const openNew = ability.canCreate ? () => setEditing("new") : undefined;

  return (
    <div className="page-card prepaid-panel">
      <div className="prepaid-toolbar">
        <p className="prepaid-hint">{t("PrepaidCard:Type:Hint")}</p>
        {openNew ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
            {t("PrepaidCard:Type:Create")}
          </Button>
        ) : null}
      </div>

      {!isLoading && types.length === 0 ? (
        <EmptyState
          title={t("PrepaidCard:Type:Empty")}
          description={t("PrepaidCard:Type:EmptyHint")}
          actionLabel={openNew ? t("PrepaidCard:Type:Create") : undefined}
          onAction={openNew}
        />
      ) : (
        <DataTable<CardTypeDto>
          rowKey="id"
          loading={isLoading}
          dataSource={types}
          pagination={false}
          scroll={{ x: 1200 }}
          columns={cardTypeColumns({
            onEdit: ability.canUpdate ? setEditing : undefined,
            onDelete: ability.canDelete ? setDeleting : undefined,
          })}
        />
      )}

      <CardTypeDialog
        editing={editing}
        saving={commands.createType.isPending || commands.updateType.isPending}
        onSubmit={(input) => void handleSave(input)}
        onClose={() => setEditing(null)}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        noun={t("PrepaidCard:Type:Noun")}
        name={deleting?.name}
        pending={commands.deleteType.isPending}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
