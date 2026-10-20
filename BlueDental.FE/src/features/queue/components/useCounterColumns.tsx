import { Button, Switch, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { useToggleServiceCounter } from "../api/queueMutations";
import type { ServiceCounter } from "../types";

export interface CounterRowActions {
  onEdit: (id: string) => void;
  onDelete: (counter: ServiceCounter) => void;
}

/**
 * The "Quản lý quầy" table: name, dentist, numbering, pause switch, Sửa / Xoá.
 * Every column but name and dentist has a fixed width; those two share the rest
 * and cut long text with "…", so the table never outgrows the modal.
 */
export function useCounterColumns({ onEdit, onDelete }: CounterRowActions): ColumnsType<ServiceCounter> {
  const toggle = useToggleServiceCounter();
  return [
    {
      title: t("Queue:Counter:Name"),
      key: "name",
      ellipsis: { showTitle: false },
      render: (_: unknown, counter) => (
        <span className="queue-manager__name">
          <span className="queue-card__avatar queue-card__avatar--sm" aria-hidden>
            {counter.numberPrefix}
          </span>
          <span className="queue-manager__name-text" title={counter.name}>
            {counter.name}
          </span>
        </span>
      ),
    },
    {
      title: t("Queue:Form:Dentist"),
      key: "dentist",
      ellipsis: true,
      render: (_: unknown, counter) => counter.dentistName ?? "—",
    },
    {
      title: t("Queue:Counter:IssuedUpTo"),
      key: "issued",
      width: 88,
      render: (_: unknown, counter) => counter.lastIssuedNumber ?? "—",
    },
    {
      title: t("Queue:Counter:Threshold"),
      key: "threshold",
      width: 136,
      render: (_: unknown, counter) => t("Queue:Minutes", counter.waitWarningMinutes),
    },
    {
      title: t("Queue:Counter:Status"),
      key: "status",
      width: 128,
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
      width: 84,
      align: "center",
      render: (_: unknown, counter) => (
        <span className="queue-manager__actions">
          <Tooltip title={t("Queue:Counter:Edit")}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label={t("Queue:Counter:EditNamed", counter.name)}
              onClick={() => onEdit(counter.id)}
            />
          </Tooltip>
          <Tooltip title={t("Common:Delete")}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label={t("Queue:Counter:DeleteNamed", counter.name)}
              onClick={() => onDelete(counter)}
            />
          </Tooltip>
        </span>
      ),
    },
  ];
}
