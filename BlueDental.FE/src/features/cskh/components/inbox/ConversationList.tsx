import { Input, Spin } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { INBOX_TAB, type ConversationSummary, type InboxCounts, type InboxTab } from "../../api/inboxApi";
import { ConversationRow } from "./ConversationRow";

const TABS: { tab: InboxTab; label: string; count: keyof InboxCounts }[] = [
  { tab: INBOX_TAB.Unreplied, label: "CSKH:Inbox:Tab:Unreplied", count: "unreplied" },
  { tab: INBOX_TAB.Mine, label: "CSKH:Inbox:Tab:Mine", count: "mine" },
  { tab: INBOX_TAB.Cared, label: "CSKH:Inbox:Tab:Cared", count: "cared" },
  { tab: INBOX_TAB.All, label: "CSKH:Inbox:Tab:All", count: "all" },
];

/** What the list shows. */
export interface InboxListView {
  items: ConversationSummary[];
  counts: InboxCounts | undefined;
  loading: boolean;
}

/** The search box and the chip on, with their setters. */
export interface InboxListQuery {
  tab: InboxTab;
  filter: string;
  onTabChange: (tab: InboxTab) => void;
  onFilterChange: (filter: string) => void;
}

interface Props {
  view: InboxListView;
  query: InboxListQuery;
  selectedId: string | null;
  meId: string | null;
  now: number;
  onSelect: (id: string) => void;
}

/** The left column: "Tìm tên, số điện thoại", the four chips with their counts, the customers. */
export function ConversationList({ view, query, selectedId, meId, now, onSelect }: Props) {
  const { items, counts, loading } = view;
  const { tab, filter, onTabChange, onFilterChange } = query;
  return (
    <section className="ibx-list" aria-label={t("CSKH:Inbox:ListLabel")}>
      <div className="ibx-list-tools">
        <Input
          type="search"
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t("CSKH:Inbox:Search")}
          aria-label={t("CSKH:Inbox:Search")}
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
        />
        <div className="ibx-chips" role="tablist" aria-label={t("CSKH:Inbox:ListLabel")}>
          {TABS.map((item) => (
            <button
              key={item.tab}
              type="button"
              role="tab"
              aria-selected={tab === item.tab}
              className={["ibx-chip", tab === item.tab && "ibx-chip--active"].filter(Boolean).join(" ")}
              onClick={() => onTabChange(item.tab)}
            >
              {t(item.label)} <span className="ibx-chip-count">{counts?.[item.count] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      <Spin spinning={loading}>
        {items.length === 0 ? (
          <p className="ibx-list-empty">{loading ? "" : t("CSKH:Inbox:Empty")}</p>
        ) : (
          <ul className="ibx-rows">
            {items.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === selectedId}
                meId={meId}
                now={now}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </Spin>
    </section>
  );
}
