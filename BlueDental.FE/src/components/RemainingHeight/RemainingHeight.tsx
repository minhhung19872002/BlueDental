import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "./RemainingHeight.css";

interface RemainingHeightProps {
  children: ReactNode;
  className?: string;
  /** Space kept under the block; defaults to the app-main bottom padding. */
  bottomGap?: number;
  /** Floor below which the block stops shrinking and the page scrolls instead. */
  minHeight?: number;
}

/**
 * Locks its height to whatever is left of the viewport below its own top
 * edge, then lays children out as a flex column — so a child with
 * `flex: 1; min-height: 0; overflow: auto` becomes the screen's scroller.
 *
 * Flex alone cannot do this here: the app shell's <main> grows with its
 * content, so nothing above bounds the height. The top offset is measured
 * instead (and re-measured when anything above reflows), which also spares
 * each screen its own `calc(100vh - header - …)` guess.
 *
 * Under 640px the lock is released and the block flows with the page.
 */
export function RemainingHeight({
  children,
  className,
  bottomGap = 16,
  minHeight = 320,
}: RemainingHeightProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      // Document coordinates, so an already-scrolled page measures the same.
      const next = Math.round(el.getBoundingClientRect().top + window.scrollY);
      setTop((prev) => (prev === next ? prev : next));
    };

    measure();
    // Anything above changing height (toolbar wrapping, banners) moves our
    // top edge without resizing us — watching the body catches those reflows.
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={["remaining-height", className].filter(Boolean).join(" ")}
      style={
        {
          "--rh-top": `${top}px`,
          "--rh-gap": `${bottomGap}px`,
          "--rh-min": `${minHeight}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
