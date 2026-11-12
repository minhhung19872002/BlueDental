import { useState } from "react";
import { toast } from "sonner";
import { useLaboCatalogCommands } from "../api/laboCatalogListApi";
import type { LaboMaterialGroupItem } from "../api/laboMaterialGroups";
import { LABO_GROUP } from "../laboTabs";
import { LaboMaterialGroupDialog } from "./LaboMaterialGroupDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";

interface Grants {
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

/**
 * Thêm / sửa / xoá a Dịch vụ of Dịch vụ Labo (P1311). The three fixed ones
 * stay locked; the server refuses to delete a Dịch vụ that still has Vật liệu.
 * Returns the GroupPanel handlers the grants allow, and the dialogs to render.
 */
export function useServiceGroupEditor({ canCreate, canUpdate, canDelete }: Grants) {
  const [editing, setEditing] = useState<{ open: boolean; group: LaboMaterialGroupItem | null }>({
    open: false,
    group: null,
  });
  const [pendingDelete, setPendingDelete] = useState<LaboMaterialGroupItem | null>(null);
  const { remove } = useLaboCatalogCommands(LABO_GROUP.Material);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync(pendingDelete.id);
      toast.success(t("Common:Deleted"));
      setPendingDelete(null);
    } catch {
      // queryClient reports the failure (e.g. Labo:0063 still has materials); the dialog stays open.
    }
  };

  const dialogs = (
    <>
      <LaboMaterialGroupDialog
        open={editing.open}
        group={editing.group}
        onClose={() => setEditing({ open: false, group: null })}
      />
      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("Labo:Noun:Service")}
        name={pendingDelete?.name ?? ""}
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );

  return {
    onCreate: canCreate ? () => setEditing({ open: true, group: null }) : undefined,
    onRename: canUpdate ? (group: LaboMaterialGroupItem) => setEditing({ open: true, group }) : undefined,
    onDelete: canDelete ? setPendingDelete : undefined,
    dialogs,
  };
}
