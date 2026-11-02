import { useMemo } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useAbility } from "@/hooks/useAbility";
import { useBranchFilter } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { useInvitedArrivals, useWaitingArrivals } from "../api/arrivalCallQueries";
import { useAdmitArrival, useInviteArrival } from "../api/arrivalCallMutations";
import type { ArrivalCallAction, ArrivalCallSection } from "../types/arrivalCall";

/**
 * The floating "Đã đến" panel (owner 2026-11-02). Who sees which list is the
 * "Bác sĩ" tick on the staff form, not a role's name; the role's Tiếp nhận
 * permissions still apply on top:
 * - ticked "Bác sĩ": only their own waiting patients (every doctor's for an
 *   admin), seen with Xem, called up with "Mời lên" given Sửa;
 * - not ticked: only the called-up patients, with Xem and Sửa, seated with
 *   "Tiếp nhận".
 * So two doctors never see each other's called-up patients. The server applies
 * the same rules; this only decides what to offer. The badge counts what still
 * waits for the viewer's click.
 */
export function useArrivalCalls() {
  const branchId = useBranchFilter();
  const isDentist = useAuthStore((s) => !!s.user?.isDentist);
  const reception = useAbility("reception");
  const canCall = isDentist && reception.canRead;
  const canAdmit = !isDentist && reception.canRead && reception.canUpdate;

  const waiting = useWaitingArrivals(branchId, canCall);
  const invited = useInvitedArrivals(branchId, canAdmit);
  const inviteMutation = useInviteArrival();
  const admitMutation = useAdmitArrival();

  const sections = useMemo(() => {
    const list: ArrivalCallSection[] = [];
    if (canCall) {
      list.push({
        action: "invite",
        title: t("Reception:ArrivalCallWaiting"),
        items: waiting.data ?? [],
        loading: waiting.isLoading,
        // Xem shows the list; "Mời lên" writes, so it takes Sửa.
        canAct: reception.canUpdate,
      });
    }
    if (canAdmit) {
      list.push({
        action: "admit",
        title: t("Reception:ArrivalCallInvitedList"),
        items: invited.data ?? [],
        loading: invited.isLoading,
        canAct: true,
      });
    }
    return list;
  }, [canCall, canAdmit, reception.canUpdate, waiting.data, waiting.isLoading, invited.data, invited.isLoading]);

  const badgeCount =
    (canCall ? (waiting.data ?? []).filter((i) => !i.invited).length : 0) +
    (canAdmit ? (invited.data ?? []).length : 0);

  const pendingId =
    (inviteMutation.isPending ? inviteMutation.variables : undefined) ??
    (admitMutation.isPending ? admitMutation.variables : undefined) ??
    null;

  const runAction = (id: string, action: ArrivalCallAction) => {
    if (action === "invite") {
      inviteMutation.mutate(id, { onSuccess: () => toast.success(t("Reception:ArrivalCallInviteSuccess")) });
      return;
    }
    admitMutation.mutate(id, { onSuccess: () => toast.success(t("Reception:ArrivalCallAdmitSuccess")) });
  };

  return { visible: canCall || canAdmit, sections, badgeCount, pendingId, runAction };
}
