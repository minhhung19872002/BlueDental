import { useState } from "react";
import { Button, Modal } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { useQueueCounters } from "../api/queueQueries";
import { useDeleteServiceCounter } from "../api/queueMutations";
import type { ServiceCounter } from "../types";
import { CounterFormDialog } from "./CounterFormDialog";
import { useCounterColumns } from "./useCounterColumns";

interface CounterManagerModalProps {
  open: boolean;
  onClose: () => void;
}

/** null = closed, "new" = adding, otherwise the id being edited. */
type Editing = null | "new" | string;

/**
 * Xoá quầy: a counter with anyone waiting, called or being seen today is
 * refused at once with a toast — the server refuses it too (Queue:0015), in
 * case the list is stale. An empty counter, paused or not, asks first.
 */
function useCounterDelete() {
  const remove = useDeleteServiceCounter();
  const [target, setTarget] = useState<ServiceCounter | null>(null);

  const request = (counter: ServiceCounter) => {
    if (counter.inQueueCount > 0) {
      notifyError(t("Queue:Counter:DeleteBusy", counter.name, counter.inQueueCount));
      return;
    }
    setTarget(counter);
  };

  const confirm = async () => {
    if (!target) return;
    try {
      await remove.mutateAsync(target.id);
      toast.success(t("Common:Deleted"));
    } catch {
      // queryClient reports the failure.
    } finally {
      setTarget(null);
    }
  };

  return { target, pending: remove.isPending, request, confirm, cancel: () => setTarget(null) };
}

/** "Quản lý quầy": every counter of the branch, its pause switch, and the add / edit / delete actions. */
export function CounterManagerModal({ open, onClose }: CounterManagerModalProps) {
  const { data: counters = [], isLoading } = useQueueCounters();
  const [editing, setEditing] = useState<Editing>(null);
  const deletion = useCounterDelete();
  const columns = useCounterColumns({ onEdit: setEditing, onDelete: deletion.request });
  const editedCounter =
    editing && editing !== "new" ? (counters.find((c) => c.id === editing) ?? null) : null;

  // Thêm / Sửa quầy takes the manager's place and hands it back when it closes;
  // the dialog lives outside the manager so hiding the manager keeps it mounted.
  return (
    <>
      <Modal
        title={<h2 className="bd-modal-title">{t("Queue:Counter:Title")}</h2>}
        open={open && editing === null}
        onCancel={onClose}
        footer={null}
        width={1000}
        destroyOnHidden
      >
        <div className="queue-manager__toolbar">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing("new")}>
            {t("Queue:Counter:Add")}
          </Button>
        </div>
        <DataTable<ServiceCounter>
          rowKey="id"
          columns={columns}
          dataSource={counters}
          loading={isLoading}
          pagination={false}
          size="small"
          // Fits the modal: long names are cut with "…" instead of a sideways scroll.
          tableLayout="fixed"
          scroll={undefined}
        />
      </Modal>
      <CounterFormDialog
        open={open && editing !== null}
        counter={editedCounter}
        counters={counters}
        onClose={() => setEditing(null)}
      />
      <ConfirmDeleteDialog
        open={open && deletion.target !== null}
        noun={t("Queue:Counter:Noun")}
        name={deletion.target?.name}
        pending={deletion.pending}
        onConfirm={() => void deletion.confirm()}
        onClose={deletion.cancel}
      />
    </>
  );
}
