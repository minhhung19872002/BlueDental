export const initTableGrabScroll = () => {
  let isGrabbing = false;
  let startX = 0;
  let scrollLeft = 0;
  let currentContainer: HTMLElement | null = null;

  const updateScrollClasses = () => {
    const containers = document.querySelectorAll('.ant-table-content, .ant-table-body');
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
    const tableContent = target.closest('.ant-table-content.has-horizontal-scroll') as HTMLElement;
    if (tableContent) return tableContent;

    const tableBody = target.closest('.ant-table-body.has-horizontal-scroll') as HTMLElement;
    if (tableBody) return tableBody;

    return null;
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
      target.closest('.ant-table-cell-fix-left') ||
      target.closest('.ant-table-cell-fix-right')
    );
  };

  const handleMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (isInteractiveElement(target)) return;

    const container = getScrollContainer(target);
    if (!container) return;

    isGrabbing = true;
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
    const walk = (x - startX) * 1.2;
    currentContainer.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    if (currentContainer) {
      currentContainer.classList.remove('is-grabbing');
    }
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
