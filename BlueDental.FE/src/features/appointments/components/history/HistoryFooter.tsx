import type { ReactNode } from "react";
import { Pagination, type PaginationProps } from "antd";
import { t } from "@/lib/i18n";

type Props =
  | {
      view: "table";
      total: number;
      page: number;
      pageSize: number;
      onChange: (page: number, pageSize: number) => void;
    }
  | {
      /** Dòng thời gian has no pager: it loads more as it is scrolled. */
      view: "timeline";
      shown: number;
    };

/** The reference writes its pager in words: ‹ Trước … Sau ›. */
const renderItem: PaginationProps["itemRender"] = (_page, type, element): ReactNode => {
  if (type === "prev") return <span className="ah-pager-word">‹ {t("Trước")}</span>;
  if (type === "next") return <span className="ah-pager-word">{t("Sau")} ›</span>;
  return element;
};

export function HistoryFooter(props: Props) {
  if (props.view === "timeline") {
    return (
      <div className="ah-footer">
        <span className="ah-footer-summary">{t("Hiển thị {0} lịch sử", props.shown)}</span>
      </div>
    );
  }

  const { total, page, pageSize, onChange } = props;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="ah-footer">
      <span className="ah-footer-summary">
        {t("Hiển thị {0}–{1} trên {2} lịch sử", first, last, total)}
      </span>
      {/* Always shown, as the reference keeps "Trước 1 Sau" even for one page. */}
      <Pagination
        className="ah-pager"
        current={page}
        pageSize={pageSize}
        total={Math.max(total, 1)}
        showSizeChanger={false}
        itemRender={renderItem}
        onChange={onChange}
      />
    </div>
  );
}
