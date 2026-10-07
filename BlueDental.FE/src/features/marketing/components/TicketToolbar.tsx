import { Button, Input, Tag, Tooltip } from "antd";
import { FileExcelOutlined, PlusOutlined, SearchOutlined, UserSwitchOutlined } from "@ant-design/icons";
import { PeriodPicker } from "@/components/PeriodPicker";
import { t } from "@/lib/i18n";
import type { TicketFilterState } from "../hooks/useTicketFilters";

interface Props {
  state: TicketFilterState;
  onChange: (change: Partial<TicketFilterState>) => void;
  /** Absent when the account may not create tickets. */
  onCreate?: () => void;
  /** Chuyển ticket (BA 8.3); absent without the transfer leaf. */
  transfer?: { onClick: () => void; disabledReason?: string };
  /** The Ticket File the list is narrowed to, from the file list's link. */
  file?: { name: string; onClear: () => void };
}

/**
 * The header's first row, laid out as Mẫu Labo's: search and the Ngày nhận
 * period on the left, Chuyển ticket and Thêm ticket on the right.
 */
export function TicketToolbar({ state, onChange, onCreate, transfer, file }: Props) {
  return (
    <div className="bd-cat-headrow">
      <div className="mkt-headgroup">
        <Input
          className="bd-cat-search"
          prefix={<SearchOutlined />}
          placeholder={t("Ticket:SearchPlaceholder")}
          aria-label={t("Ticket:SearchPlaceholder")}
          value={state.keyword}
          maxLength={100}
          allowClear
          onChange={(e) => onChange({ keyword: e.target.value })}
        />
        <PeriodPicker value={state.period} onChange={(period) => onChange({ period })} clearableMode />
        {file && (
          <Tag className="mkt-file-chip" icon={<FileExcelOutlined />} closable onClose={file.onClear}>
            {t("Ticket:FileChip", file.name)}
          </Tag>
        )}
      </div>
      <div className="mkt-headgroup">
        {transfer && (
          <Tooltip title={transfer.disabledReason}>
            <Button icon={<UserSwitchOutlined />} disabled={Boolean(transfer.disabledReason)} onClick={transfer.onClick}>
              {t("Ticket:Transfer")}
            </Button>
          </Tooltip>
        )}
        {onCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            {t("Ticket:Create")}
          </Button>
        )}
      </div>
    </div>
  );
}
