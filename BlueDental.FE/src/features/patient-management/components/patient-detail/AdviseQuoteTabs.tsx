import { CloseCircleFilled } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { AdviseQuotesState } from "../../hooks/useAdviseQuotes";

/**
 * The tab strip at the head of Phiếu tư vấn: the consulting list itself, then
 * one tab per báo giá raised off it. Each quote tab carries the reference's
 * round red ✕ at its corner, which drops that quote.
 */
export function AdviseQuoteTabs({
  quotes,
  onReopenAdvise,
}: {
  quotes: AdviseQuotesState;
  /** Clicking the plan tab while it is already open opens "Tạo phiếu tư vấn". */
  onReopenAdvise: () => void;
}) {
  return (
    <div className="pd-advise-tabs" role="tablist" aria-label={t("Phiếu tư vấn và báo giá")}>
      <button
        type="button"
        role="tab"
        aria-selected={quotes.activeId === null}
        className={["pd-advise-tab", quotes.activeId === null && "pd-advise-tab--on"]
          .filter(Boolean)
          .join(" ")}
        onClick={() => (quotes.activeId === null ? onReopenAdvise() : quotes.show(null))}
      >
        {t("Phiếu tư vấn")}
      </button>

      {quotes.quotes.map((quote) => {
        const open = quotes.activeId === quote.id;
        return (
          <span key={quote.id} className="pd-advise-tab-wrap">
            <button
              type="button"
              role="tab"
              aria-selected={open}
              className={["pd-advise-tab", open && "pd-advise-tab--on"]
                .filter(Boolean)
                .join(" ")}
              onClick={() => quotes.show(quote.id)}
            >
              {quote.label}
            </button>
            {/* Only the open quote offers its ✕, as the reference does: the
                others are just a way back to what they hold. */}
            {open && (
              <button
                type="button"
                className="pd-advise-tab-drop"
                aria-label={t("Bỏ {0}", quote.label)}
                onClick={() => quotes.remove(quote.id)}
              >
                <CloseCircleFilled aria-hidden="true" />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
