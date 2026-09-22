const GRAB_SCROLL_SELECTORS = '.ant-table-content, .ant-table-body, .appt-mini-cal-content, .wsb-table-scroll';

/**
 * How far the pointer has to travel before a grab counts as a scroll rather
 * than a click. Below this a shaky hand on a row still opens it.
 */
const DRAG_SLOP_PX = 4;

export const initTableGrabScroll = () => {
  let isGrabbing = false;
  let didScroll = false;
  let startX = 0;
  let scrollLeft = 0;
  let currentContainer: HTMLElement | null = null;

  const updateScrollClasses = () => {
    const containers = document.querySelectorAll(GRAB_SCROLL_SELECTORS);
    containers.forEach((container) => {
      const el = container as HTMLElement;
      if (el.scrollWidth > el.clientWidth) {
        el.classList.add('has-horizontal-scroll');
      } else {
        el.classList.remove('has-horizontal-scroll');
      }
    });
  };

  updateScrollClasses();

  window.addEventListener('resize', updateScrollClasses);

  const observer = new MutationObserver(() => {
    updateScrollClasses();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  const getScrollContainer = (target: HTMLElement): HTMLElement | null => {
    return target.closest(
      GRAB_SCROLL_SELECTORS.split(', ').map(s => `${s}.has-horizontal-scroll`).join(', ')
    ) as HTMLElement | null;
  };

  const isInteractiveElement = (target: HTMLElement): boolean => {
    return !!(
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('[contenteditable]') ||
      target.closest('.ant-checkbox') ||
      target.closest('.ant-switch') ||
      target.closest('.ant-select') ||
      target.closest('.ant-dropdown-trigger') ||
      target.closest('.ant-btn') ||
      target.closest('.ant-tag') ||
      target.closest('[role="button"]') ||
      // Ant Design 6 renamed these parts from `…-fix-left/right` to
      // `…-fix-start/end`; both are listed so a pinned cell stays a pinned cell.
      target.closest('.ant-table-cell-fix-left') ||
      target.closest('.ant-table-cell-fix-right') ||
      target.closest('.ant-table-cell-fix-start') ||
      target.closest('.ant-table-cell-fix-end')
    );
  };

  const handleMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (isInteractiveElement(target)) return;

    const container = getScrollContainer(target);
    if (!container) return;

    isGrabbing = true;
    didScroll = false;
    currentContainer = container;
    startX = e.pageX;
    scrollLeft = container.scrollLeft;

    container.classList.add('is-grabbing');
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isGrabbing || !currentContainer) return;

    e.preventDefault();
    const x = e.pageX;
    if (Math.abs(x - startX) > DRAG_SLOP_PX) didScroll = true;
    const walk = (x - startX) * 1.2;
    currentContainer.scrollLeft = scrollLeft - walk;
  };

  /**
   * Dragging a table sideways must not also activate what is under the cursor.
   * The browser still fires a click after the grab, so once the pointer has
   * actually travelled, the next click is swallowed in the capture phase —
   * otherwise letting go over a row opened that row's dialog.
   */
  const swallowNextClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const handleMouseUp = () => {
    if (currentContainer) {
      currentContainer.classList.remove('is-grabbing');
    }
    if (didScroll) {
      document.addEventListener('click', swallowNextClick, { capture: true, once: true });
      // Nothing to swallow if the drag ended without a click (dropped outside
      // the document, say): the listener is dropped on the next frame so it
      // cannot eat an unrelated click later on.
      window.setTimeout(
        () => document.removeEventListener('click', swallowNextClick, true),
        0,
      );
    }
    didScroll = false;
    isGrabbing = false;
    currentContainer = null;
  };

  const handleMouseLeave = (e: MouseEvent) => {
    if (e.relatedTarget === null) {
      handleMouseUp();
    }
  };

  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('mouseup', handleMouseUp, true);
  document.addEventListener('mouseleave', handleMouseLeave, true);

  return () => {
    document.removeEventListener('mousedown', handleMouseDown, true);
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('mouseup', handleMouseUp, true);
    document.removeEventListener('mouseleave', handleMouseLeave, true);
    window.removeEventListener('resize', updateScrollClasses);
    observer.disconnect();
  };
};

export default initTableGrabScroll;
