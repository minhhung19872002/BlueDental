import type { ReactElement, UIEvent } from "react";
import { Spin, type SelectProps } from "antd";
import { SelectLoading } from "@/components/SelectLoading";
import { isNearScrollEnd } from "@/utils/scrollEnd";

interface PagedOptions {
  /** Asks for the next page; a no-op once every page is in or one is loading. */
  loadMore: () => void;
  loadingMore: boolean;
  /** Any page on its way — the first one shows placeholder rows rather than "no data". */
  loading?: boolean;
}

/**
 * The AntD Select props that page a server list in as it is scrolled: the
 * next page is asked for near the last row, and a spinner lies over the
 * bottom of the list while it loads. Before the first page there are
 * placeholder rows, so the popup does not open as one line and then jump.
 * The SearchSelect counterpart is its `onLoadMore` prop.
 */
export function pagedSelectProps({
  loadMore,
  loadingMore,
  loading = false,
}: PagedOptions): Pick<SelectProps, "onPopupScroll" | "popupRender" | "notFoundContent"> {
  return {
    ...(loading ? { notFoundContent: <SelectLoading /> } : {}),
    onPopupScroll: (event: UIEvent<HTMLDivElement>) => {
      if (isNearScrollEnd(event.currentTarget)) loadMore();
    },
    popupRender: (menu: ReactElement) => (
      <>
        {menu}
        {loadingMore && (
          <div className="bd-select-loading-more">
            <Spin size="small" />
          </div>
        )}
      </>
    ),
  };
}
