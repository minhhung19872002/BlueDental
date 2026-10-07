import { Button } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FileExcelOutlined, UnorderedListOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { ActionTooltip } from "@/components/ActionTooltip";
import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import { TICKET_STATUS, type TicketStats, type TicketStatus } from "../api/ticketApi";
import type { TicketImportFileDto } from "../api/ticketFileApi";
import { TICKET_STATUS_CONFIG } from "./ticketConfig";

/** The status counters of a file's progress, in workflow order. */
const PROGRESS: readonly [TicketStatus, keyof TicketStats][] = [
  [TICKET_STATUS.New, "new"],
  [TICKET_STATUS.InCare, "inCare"],
  [TICKET_STATUS.Booked, "booked"],
  [TICKET_STATUS.Arrived, "arrived"],
  [TICKET_STATUS.NotPotential, "notPotential"],
];

/** "Tình trạng xử lý theo từng file": one chip per status the file's tickets are in, then the overdue count. */
function FileProgress({ progress }: { progress: TicketStats }) {
  const chips = PROGRESS.filter(([, stat]) => progress[stat] > 0);
  if (chips.length === 0) return <span className="bd-cat-num">—</span>;
  return (
    <div className="mkt-tags">
      {chips.map(([status, stat]) => {
        const { label, bg, color } = TICKET_STATUS_CONFIG[status];
        return <StatusBadge key={stat} label={`${t(label)} ${progress[stat]}`} bg={bg} color={color} />;
      })}
      {progress.overdue > 0 && <span className="mkt-overdue">{`${t("Ticket:Overdue")} ${progress.overdue}`}</span>}
    </div>
  );
}

const count = (value: number) => <span className="bd-cat-num">{value}</span>;

export function ticketFileColumns(onOpen: (file: TicketImportFileDto) => void): ColumnsType<TicketImportFileDto> {
  return [
    {
      title: t("Ticket:File:Col:Name"),
      key: "name",
      width: 260,
      fixed: "left",
      render: (_, file) => (
        <span className="mkt-file-name">
          <FileExcelOutlined />
          <span className="mkt-file-name__text">{file.fileName}</span>
        </span>
      ),
    },
    {
      title: t("Ticket:File:Col:Imported"),
      key: "imported",
      width: 150,
      render: (_, file) => dayjs(file.creationTime).format("DD/MM/YYYY HH:mm"),
    },
    { title: t("Ticket:File:Col:Creator"), key: "creator", width: 160, render: (_, file) => file.creatorName ?? "—" },
    { title: t("Ticket:File:Col:Rows"), key: "rows", width: 90, align: "right", render: (_, file) => count(file.rowCount) },
    { title: t("Ticket:File:Col:Created"), key: "created", width: 110, align: "right", render: (_, file) => count(file.createdCount) },
    {
      title: t("Ticket:File:Col:Reoccurred"),
      key: "reoccurred",
      width: 140,
      align: "right",
      render: (_, file) => count(file.reoccurredCount),
    },
    { title: t("Ticket:File:Col:Progress"), key: "progress", width: 320, render: (_, file) => <FileProgress progress={file.progress} /> },
    {
      title: t("Ticket:File:Col:Assignees"),
      key: "assignees",
      width: 220,
      render: (_, file) => (file.assigneeNames.length ? file.assigneeNames.join(", ") : t("Ticket:Pool")),
    },
    {
      title: t("Common:Actions"),
      key: "actions",
      width: 90,
      align: "center",
      fixed: "right",
      render: (_, file) => (
        <ActionTooltip className="mkt-tip" title={t("Ticket:File:Open")}>
          <Button
            type="text"
            size="small"
            aria-label={t("Ticket:File:Open")}
            icon={<UnorderedListOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(file);
            }}
          />
        </ActionTooltip>
      ),
    },
  ];
}
