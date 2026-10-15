import { useEffect, useState, type RefObject } from "react";
import { FloatButton } from "antd";
import { ArrowUpOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props {
  /** The block that calls the button up: shown once it scrolls into view. */
  anchor: RefObject<HTMLElement | null>;
}

/** The nearest ancestor that scrolls — the app's content pane, or the window. */
function scrollParentOf(element: HTMLElement): HTMLElement | Window {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return window;
}

/**
 * A "back to top" button in the bottom-right corner, shown while `anchor` is in
 * view or scrolled past, and hidden again once the page is scrolled back above
 * it. Clicking it scrolls whatever holds the anchor back to the top.
 */
export function ScrollTopButton({ anchor }: Props) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const target = anchor.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      // Above the viewport counts too: the anchor was reached, then passed.
      setShown(entry.isIntersecting || entry.boundingClientRect.bottom < 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [anchor]);

  if (!shown) return null;

  const handleClick = () => {
    const target = anchor.current;
    if (target) scrollParentOf(target).scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <FloatButton
      type="primary"
      icon={<ArrowUpOutlined />}
      tooltip={t("Common:ScrollTop")}
      aria-label={t("Common:ScrollTop")}
      onClick={handleClick}
    />
  );
}
