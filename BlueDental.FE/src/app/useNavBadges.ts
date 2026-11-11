import { useMemo } from "react";

import { useAuthStore } from "@/features/auth/store/authStore";
import { useXrayInboxCount } from "@/features/xray-inbox/api/xrayInboxQueries";
import { useBranchFilter } from "@/lib/clinicBranch";
import { isAnyGranted } from "@/lib/permissions";

import { NAV_ENTRIES } from "./nav";
import type { NavBadges } from "./HeaderNav";

/**
 * What waits behind a menu entry. Today that is only Ảnh chưa gán hồ sơ
 * (F-95), asked for just by accounts that may open it, for the branch the
 * header shows.
 */
export function useNavBadges(): NavBadges {
  const canSeeXrayInbox = useAuthStore((s) =>
    isAnyGranted(NAV_ENTRIES.xrayInbox.permissions, (p) => s.hasPermission(p)),
  );
  const xrayInbox = useXrayInboxCount(useBranchFilter(), canSeeXrayInbox);
  const xrayCount = canSeeXrayInbox ? (xrayInbox.data ?? 0) : 0;

  return useMemo(() => ({ [NAV_ENTRIES.xrayInbox.path]: xrayCount }), [xrayCount]);
}
