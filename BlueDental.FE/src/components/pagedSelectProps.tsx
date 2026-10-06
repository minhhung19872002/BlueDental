import type { ReactElement, UIEvent } from "react";
import { Spin, type SelectProps } from "antd";
import { isNearScrollEnd } from "@/utils/scrollEnd";

interface PagedOptions {
  /** Asks for the next page; a no-op once every page is in or one is loading. */
  loadMore: () => void;
  loadingMore: boolean;
}

/**
 * The AntD Select props that page a server list in as it is scrolled: the
 * next page is asked for near the last row, and a spinner sits under it
 * while it loads. The SearchSelect counterpart is its `onLoadMore` prop.
 */
export function pagedSelectProps({
  loadMore,
  loadingMore,
}: PagedOptions): Pick<SelectProps, "onPopupScroll" | "popupRender"> {
  return {
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
