import { useState } from "react";
import { Button, Modal, Switch, Tooltip } from "antd";
import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { DataTable } from "@/components/DataTable";
import { useQueueCounters } from "../api/queueQueries";
import { useToggleServiceCounter } from "../api/queueMutations";
import type { ServiceCounter } from "../types";
import { CounterFormDialog } from "./CounterFormDialog";

interface CounterManagerModalProps {
  open: boolean;
  onClose: () => void;
}

/** null = closed, "new" = adding, otherwise the id being edited. */
type Editing = null | "new" | string;

function useCounterColumns(onEdit: (id: string) => void): ColumnsType<ServiceCounter> {
  const toggle = useToggleServiceCounter();
  return [
    {
      title: t("Queue:Counter:Name"),
      key: "name",
      render: (_: unknown, counter) => (
        <span className="queue-manager__name">
          <span className="queue-card__avatar queue-card__avatar--sm" aria-hidden>
            {counter.numberPrefix}
          </span>
          {counter.name}
        </span>
      ),
    },
    {
      title: t("Queue:Form:Dentist"),
      key: "dentist",
      render: (_: unknown, counter) => counter.dentistName ?? "—",
    },
    {
      title: t("Queue:Counter:IssuedUpTo"),
      key: "issued",
      render: (_: unknown, counter) => counter.lastIssuedNumber ?? "—",
    },
    {
      title: t("Queue:Counter:Threshold"),
      key: "threshold",
      render: (_: unknown, counter) => t("Queue:Minutes", counter.waitWarningMinutes),
    },
    {
      title: t("Queue:Counter:Status"),
      key: "status",
      width: 150,
      render: (_: unknown, counter) => (
        <span className="queue-counter-toggle">
          <Switch
            checked={counter.isActive}
            size="small"
            aria-label={counter.name}
            loading={toggle.isPending && toggle.variables === counter.id}
            onChange={() => toggle.mutate(counter.id)}
          />
          {counter.isActive ? t("Queue:Counter:Active") : t("Queue:Counter:Paused")}
        </span>
      ),
    },
    {
      title: t("Queue:Counter:Actions"),
      key: "actions",
      width: 72,
      align: "center",
      render: (_: unknown, counter) => (
        <Tooltip title={t("Queue:Counter:Edit")}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            aria-label={t("Queue:Counter:EditNamed", counter.name)}
            onClick={() => onEdit(counter.id)}
          />
        </Tooltip>
      ),
    },
  ];
}

/** "Quản lý quầy": every counter of the branch, its pause switch, and the add / edit dialog. */
export function CounterManagerModal({ open, onClose }: CounterManagerModalProps) {
  const { data: counters = [], isLoading } = useQueueCounters();
  const [editing, setEditing] = useState<Editing>(null);
  const columns = useCounterColumns(setEditing);
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
        width={860}
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
        />
      </Modal>
      <CounterFormDialog
        open={open && editing !== null}
        counter={editedCounter}
        counters={counters}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
