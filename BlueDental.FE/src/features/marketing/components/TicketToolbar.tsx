import { Button, Input } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { PeriodPicker } from "@/components/PeriodPicker";
import { t } from "@/lib/i18n";
import type { TicketFilterState } from "../hooks/useTicketFilters";

interface Props {
  state: TicketFilterState;
  onChange: (change: Partial<TicketFilterState>) => void;
  /** Absent when the account may not create tickets. */
  onCreate?: () => void;
}

/**
 * The header's first row, laid out as Mẫu Labo's: search and the Ngày nhận
 * period on the left, Thêm ticket on the right.
 */
export function TicketToolbar({ state, onChange, onCreate }: Props) {
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
      </div>
      {onCreate && (
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          {t("Ticket:Create")}
        </Button>
      )}
    </div>
  );
}
