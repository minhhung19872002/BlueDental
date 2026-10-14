import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * For the money screens (Báo cáo, Tài chính → Thanh toán, Quản lý thu chi):
 * coming back to the browser window always re-reads (owner, 2026-10-14), so
 * two tabs never show figures from two different moments. The app-wide
 * default keeps data five minutes and ignores window focus — right for
 * catalogues, not for running totals.
 *
 * Mounting does not force a read: a card that hides its table behind a
 * spinner while fetching would remount the table, which would read again,
 * forever. Ten seconds of freshness breaks that loop; switching tabs inside
 * a page re-reads through {@link useRefreshOnTabChange} instead.
 */
export const ALWAYS_FRESH = {
  staleTime: 10_000,
  refetchOnWindowFocus: "always",
} as const;

/**
 * Re-reads the given query roots each time `tab` changes — not on the first
 * render, which reads by itself. One invalidation, so one read per switch.
 */
export function useRefreshOnTabChange(tab: string, roots: readonly (readonly unknown[])[]) {
  const queryClient = useQueryClient();
  const first = useRef(true);
  const rootsRef = useRef(roots);
  rootsRef.current = roots;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    for (const queryKey of rootsRef.current) {
      // A read already under way is left to finish rather than cancelled.
      void queryClient.invalidateQueries({ queryKey }, { cancelRefetch: false });
    }
  }, [tab, queryClient]);
}
