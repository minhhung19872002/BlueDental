import { Button } from "antd";
import { ClearOutlined } from "@ant-design/icons";
import { FloatingLabel } from "@/components/FloatingLabel";
import { SearchSelect, type SearchSelectOption } from "@/components/SearchSelect";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { t } from "@/lib/i18n";
import type { TicketStats } from "../api/ticketApi";
import type { TicketFilterState } from "../hooks/useTicketFilters";
import { STATUS_TABS } from "../ticketTabs";

interface Props {
  state: TicketFilterState;
  stats: TicketStats | undefined;
  onChange: (change: Partial<TicketFilterState>) => void;
  isFiltered: boolean;
  onReset: () => void;
  tagOptions: SearchSelectOption[];
  sourceOptions: SearchSelectOption[];
  /** Present only for accounts that see everyone's tickets — the rest see their own and the pool. */
  staffOptions?: SearchSelectOption[];
}

/**
 * The header's second row: the status tabs, each with its count, then the three
 * pickers a marketer works by — Người phụ trách, Nguồn and Thẻ (R-796).
 */
export function TicketFilterBar(props: Props) {
  const { state, stats, onChange, isFiltered, onReset } = props;
  const tabs = STATUS_TABS.map((tab) => ({ key: tab.key, label: `${t(tab.label)} (${stats?.[tab.stat] ?? 0})` }));
  const pickers: { label: string; value?: string; options: SearchSelectOption[]; set: (v?: string) => void }[] = [
    {
      label: t("Ticket:Field:Assignee"),
      value: state.assignee,
      options: [{ value: "pool", label: t("Ticket:Pool") }, ...(props.staffOptions ?? [])],
      set: (assignee) => onChange({ assignee }),
    },
    {
      label: t("Ticket:Field:Source"),
      value: state.sourceTaxonomyId,
      options: props.sourceOptions,
      set: (sourceTaxonomyId) => onChange({ sourceTaxonomyId }),
    },
    { label: t("Ticket:Field:Tags"), value: state.tagId, options: props.tagOptions, set: (tagId) => onChange({ tagId }) },
  ];

  return (
    <div className="mkt-headgroup">
      <SegmentedTabs items={tabs} activeKey={state.tab} onChange={(tab) => onChange({ tab })} />
      {pickers.map((picker) => (
        <FloatingLabel key={picker.label} label={picker.label} floated={Boolean(picker.value)} className="mkt-filter">
          <SearchSelect value={picker.value} options={picker.options} allowClear onChange={picker.set} />
        </FloatingLabel>
      ))}
      {isFiltered && (
        <Button type="link" icon={<ClearOutlined />} onClick={onReset}>
          {t("Ticket:ClearFilters")}
        </Button>
      )}
    </div>
  );
}
