import type { ColumnsType } from "antd/es/table";
import { getLocale, t } from "@/lib/i18n";
import { DataTable } from "@/components/DataTable";
import { channelLabels, type MessageTemplateDto } from "../../api/templateApi";
import { purposeLabel } from "./templateLook";
import { TemplateStatusBadge } from "./TemplateStatusBadge";

interface TemplateTableProps {
  items: MessageTemplateDto[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function buildColumns(): ColumnsType<MessageTemplateDto> {
  const channels = channelLabels();
  return [
    {
      key: "name",
      title: t("CSKH:Template:Col:Name"),
      width: 260,
      render: (_, row) => (
        <div className="tpl-name-cell">
          <span className="tpl-name">{row.name}</span>
          <span className="tpl-snippet">{row.subject ?? row.content}</span>
        </div>
      ),
    },
    {
      key: "channel",
      title: t("CSKH:Template:Col:Channel"),
      width: 90,
      render: (_, row) => <span className="cskh-badge">{channels[row.channel]}</span>,
    },
    {
      key: "purpose",
      title: t("CSKH:Template:Col:Purpose"),
      width: 150,
      render: (_, row) => purposeLabel(row.purpose),
    },
    {
      key: "variables",
      title: t("CSKH:Template:Col:Variables"),
      width: 90,
      render: (_, row) => row.variables.length,
    },
    {
      key: "sent",
      title: t("CSKH:Template:Col:Sent"),
      width: 100,
      render: (_, row) => row.sentCount.toLocaleString(getLocale()),
    },
    {
      key: "status",
      title: t("CSKH:Template:Col:Status"),
      width: 130,
      render: (_, row) => <TemplateStatusBadge status={row.status} />,
    },
  ];
}

/** The whole list on one page — a branch keeps tens of templates, not thousands. */
export function TemplateTable({ items, loading, selectedId, onSelect }: TemplateTableProps) {
  return (
    <div className="cskh-table-card tpl-table-card">
      <DataTable<MessageTemplateDto>
        className="cskh-table"
        rowKey="id"
        columns={buildColumns()}
        dataSource={items}
        loading={loading}
        pagination={false}
        locale={{ emptyText: t("CSKH:Template:Empty") }}
        rowClassName={(row) => ["tpl-row", row.id === selectedId && "tpl-row--selected"].filter(Boolean).join(" ")}
        onRow={(row) => ({ onClick: () => onSelect(row.id) })}
      />
      <div className="tpl-table-footer">
        <span>{t("CSKH:Template:Footer", items.length)}</span>
        <span>{t("CSKH:Template:Page", 1, 1)}</span>
      </div>
    </div>
  );
}
