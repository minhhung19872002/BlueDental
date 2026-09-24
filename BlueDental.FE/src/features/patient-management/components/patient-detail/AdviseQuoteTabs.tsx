import { useState } from "react";
import { CloseCircleFilled } from "@ant-design/icons";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";
import type { AdviseQuotesState } from "../../hooks/useAdviseQuotes";

/**
 * The tab strip at the head of Phiếu tư vấn: the consulting list itself, then
 * one tab per báo giá raised off it. Each quote tab carries the reference's
 * round red ✕ at its corner, which drops that quote — after asking, because
 * the drop reaches the server and cannot be taken back.
 *
 * The "Phiếu tư vấn" tab only ever switches back to the list. Clicking it while
 * it is already open does nothing; an earlier draft opened "Tạo phiếu tư vấn"
 * from here, which the reference does not do (measured 2026-09-22).
 */
export function AdviseQuoteTabs({ quotes }: { quotes: AdviseQuotesState }) {
  const [dropping, setDropping] = useState<{ id: string; label: string } | null>(null);

  return (
    <div className="pd-advise-tabs" role="tablist" aria-label={t("Patient:ConsultQuoteTabs")}>
      <button
        type="button"
        role="tab"
        aria-selected={quotes.activeId === null}
        className={["pd-advise-tab", quotes.activeId === null && "pd-advise-tab--on"]
          .filter(Boolean)
          .join(" ")}
        onClick={() => quotes.show(null)}
      >
        {t("Patient:ConsultTab")}
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
                aria-label={t("Patient:RemoveQuoteLabel", quote.label)}
                onClick={() => setDropping({ id: quote.id, label: quote.label })}
              >
                <CloseCircleFilled aria-hidden="true" />
              </button>
            )}
          </span>
        );
      })}

      <ConfirmDeleteDialog
        open={dropping !== null}
        noun={t("Patient:ConsultQuote")}
        title={t("Patient:DeleteQuote")}
        question={t(
          "Patient:Quote:DeleteQuestion",
          dropping?.label ?? "",
        )}
        onConfirm={() => {
          if (dropping) quotes.remove(dropping.id);
          setDropping(null);
        }}
        onClose={() => setDropping(null)}
      />
    </div>
  );
}
