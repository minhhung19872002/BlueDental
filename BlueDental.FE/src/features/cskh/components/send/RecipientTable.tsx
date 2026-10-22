import { useRef, type CSSProperties } from "react";
import { Spin } from "antd";
import { useVirtualizer } from "@tanstack/react-virtual";
import { t } from "@/lib/i18n";
import type { MessageRecipient } from "../../api/sendApi";
import { MESSAGE_CHANNEL, type MessageChannel } from "../../api/templateApi";
import { RecipientRow, type RowLead } from "./RecipientRow";

/** One row with a code line under the name; rows with a "Thiếu …" line are measured. */
const ROW_ESTIMATE = 53;

const CONTACT_COLUMN: Record<MessageChannel, string> = {
  [MESSAGE_CHANNEL.Sms]: "CSKH:Send:Col:Phone",
  [MESSAGE_CHANNEL.Zalo]: "CSKH:Send:Col:Zalo",
  [MESSAGE_CHANNEL.Email]: "CSKH:Send:Col:Email",
};

interface RecipientTableProps {
  rows: readonly MessageRecipient[];
  channel: MessageChannel;
  contactName: string;
  loading: boolean;
  emptyText: string;
  /** Khách lẻ: a tick per row instead of the row number. */
  isChecked: ((patientId: string) => boolean) | null;
  onToggle: (patientId: string) => void;
  /** A care list only: "Xóa" drops the row from this send. */
  onRemove: ((recipient: MessageRecipient) => void) | null;
}

/**
 * The customers of "Gửi tới". Virtualised: a month of a CSKH list runs to
 * hundreds of rows (CLAUDE.md §16.9). The head sticks inside the scroller so a
 * scrollbar never pushes the body columns off the head ones.
 */
export function RecipientTable(props: RecipientTableProps) {
  const { rows, channel, contactName, loading, emptyText, isChecked, onToggle, onRemove } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    getItemKey: (index) => rows[index]?.key ?? index,
    overscan: 8,
  });

  const leadOf = (row: MessageRecipient, index: number): RowLead =>
    isChecked
      ? { kind: "tick", checked: row.patientId !== null && isChecked(row.patientId) }
      : { kind: "number", index };

  return (
    <div className="snd-table-scroll">
      <div
        role="table"
        aria-rowcount={rows.length + 1}
        className={["snd-table", onRemove && "snd-table--removable"].filter(Boolean).join(" ")}
      >
        <div ref={scrollRef} className="snd-table-body">
          <div role="rowgroup" className="snd-table-head">
            <div role="row" className="snd-row snd-row--head">
              <span role="columnheader" className="snd-cell snd-cell--lead">{isChecked ? "" : "#"}</span>
              <span role="columnheader" className="snd-cell">{t("CSKH:Send:Col:Customer")}</span>
              <span role="columnheader" className="snd-cell">{t(CONTACT_COLUMN[channel])}</span>
              <span role="columnheader" className="snd-cell">{t("CSKH:Send:Col:Dentist")}</span>
              <span role="columnheader" className="snd-cell">{t("CSKH:Send:Col:Received")}</span>
              {onRemove && <span role="columnheader" className="snd-cell snd-cell--action" />}
            </div>
          </div>
          {loading && (
            <div className="snd-table-state">
              <Spin />
            </div>
          )}
          {!loading && rows.length === 0 && <p className="snd-table-state">{emptyText}</p>}
          {!loading && rows.length > 0 && (
            <div role="rowgroup" className="snd-rows" style={{ "--snd-rows-height": `${virtualizer.getTotalSize()}px` } as CSSProperties}>
              {virtualizer.getVirtualItems().map((item) => (
                <div
                  key={item.key}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  className="snd-rows-item"
                  style={{ "--snd-row-y": `${item.start}px` } as CSSProperties}
                >
                  <RecipientRow
                    recipient={rows[item.index]}
                    channel={channel}
                    contactName={contactName}
                    lead={leadOf(rows[item.index], item.index)}
                    onToggle={onToggle}
                    onRemove={onRemove}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
