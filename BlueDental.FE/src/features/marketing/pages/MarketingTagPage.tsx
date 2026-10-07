import { useState } from "react";
import { Button, Input } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { toast } from "sonner";
import { ActionTooltip } from "@/components/ActionTooltip";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { useAbility, type Ability } from "@/hooks/useAbility";
import { useDebounce } from "@/hooks/useDebounce";
import { t } from "@/lib/i18n";
import { useTicketTagCommands, useTicketTags, type TicketTagDto, type TicketTagInput } from "../api/ticketSupportApi";
import { MarketingShell } from "../components/MarketingShell";
import { TagDialog } from "../components/TagDialog";
import { TagChip } from "../components/TicketTagChips";
import "../components/marketing.css";

type Pending = { kind: "none" } | { kind: "form"; tag: TicketTagDto | null } | { kind: "delete"; tag: TicketTagDto };

function tagColumns(ability: Ability, onPick: (pending: Pending) => void): ColumnsType<TicketTagDto> {
  return [
    { title: t("Ticket:Tag:Name"), key: "name", render: (_, tag) => <TagChip tag={tag} /> },
    {
      title: t("Ticket:Tag:ProcessingDays"),
      key: "days",
      width: 180,
      render: (_, tag) =>
        tag.maxProcessingDays ? t("Ticket:DaysCount", tag.maxProcessingDays) : <span className="bd-cat-num">{t("Ticket:Tag:NoDeadline")}</span>,
    },
    { title: t("Common:CreatedAt"), key: "created", width: 160, render: (_, tag) => dayjs(tag.creationTime).format("DD/MM/YYYY") },
    {
      title: t("Common:Actions"),
      key: "actions",
      width: 110,
      align: "center",
      render: (_, tag) => (
        <div className="bd-cat-rowactions">
          {ability.canUpdate && (
            <ActionTooltip className="mkt-tip" title={t("Common:Edit")}>
              <Button type="text" size="small" aria-label={t("Common:Edit")} icon={<EditOutlined />} onClick={() => onPick({ kind: "form", tag })} />
            </ActionTooltip>
          )}
          {ability.canDelete && (
            <ActionTooltip className="mkt-tip" title={t("Common:Delete")}>
              <Button type="text" size="small" danger aria-label={t("Common:Delete")} icon={<DeleteOutlined />} onClick={() => onPick({ kind: "delete", tag })} />
            </ActionTooltip>
          )}
        </div>
      ),
    },
  ];
}

/** Marketing → Thẻ ticket (/marketing/tags): the branch's tags and their Thời gian xử lý. */
export function MarketingTagPage() {
  const ability = useAbility("marketingTicketTag");
  const [keyword, setKeyword] = useState("");
  const [pending, setPending] = useState<Pending>({ kind: "none" });
  const { data: tags = [], isLoading } = useTicketTags(useDebounce(keyword, 400));
  const commands = useTicketTagCommands();
  const close = () => setPending({ kind: "none" });

  const run = async (work: () => Promise<unknown>, message: string) => {
    try {
      await work();
      toast.success(message);
      close();
    } catch {
      // queryClient reports the failure.
    }
  };

  const handleSubmit = (input: TicketTagInput) => {
    if (pending.kind !== "form") return;
    const editing = pending.tag;
    void run(
      () => (editing ? commands.update.mutateAsync({ id: editing.id, input }) : commands.create.mutateAsync(input)),
      t(editing ? "Common:Updated" : "Ticket:Tag:Created"),
    );
  };
  const handleDelete = () => {
    if (pending.kind === "delete") void run(() => commands.remove.mutateAsync(pending.tag.id), t("Common:Deleted"));
  };

  return (
    <MarketingShell activeKey="tags" subtitle="Ticket:Tag:PageSubtitle">
      <div className="bd-cat-header mkt-header">
        <div className="bd-cat-headrow">
          <Input
            className="bd-cat-search"
            prefix={<SearchOutlined />}
            placeholder={t("Ticket:Tag:Search")}
            aria-label={t("Ticket:Tag:Search")}
            value={keyword}
            maxLength={100}
            allowClear
            onChange={(e) => setKeyword(e.target.value)}
          />
          {ability.canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setPending({ kind: "form", tag: null })}>
              {t("Ticket:Tag:Create")}
            </Button>
          )}
        </div>
      </div>

      <div className="bd-cat-body">
        <div className="bd-cat-card">
          <DataTable<TicketTagDto>
            columns={tagColumns(ability, setPending)}
            dataSource={tags}
            rowKey="id"
            loading={isLoading}
            locale={{ emptyText: t(keyword ? "Common:NoResultsMatch" : "Ticket:Tag:Empty") }}
            pagination={false}
          />
        </div>
      </div>

      <TagDialog
        open={pending.kind === "form"}
        tag={pending.kind === "form" ? pending.tag : null}
        saving={commands.create.isPending || commands.update.isPending}
        onSubmit={handleSubmit}
        onClose={close}
      />
      <ConfirmDeleteDialog
        open={pending.kind === "delete"}
        noun={t("Ticket:Tag:Noun")}
        name={pending.kind === "delete" ? pending.tag.name : ""}
        note={t("Ticket:Tag:DeleteNote")}
        pending={commands.remove.isPending}
        onConfirm={handleDelete}
        onClose={close}
      />
    </MarketingShell>
  );
}
