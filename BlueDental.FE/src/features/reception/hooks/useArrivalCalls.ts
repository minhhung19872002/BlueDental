import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useAbility } from "@/hooks/useAbility";
import { useSoundUnlocked } from "@/hooks/useSoundUnlocked";
import { useBranchFilter } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { useInvitedArrivals, useWaitingArrivals } from "../api/arrivalCallQueries";
import { useAdmitArrival, useInviteArrival } from "../api/arrivalCallMutations";
import type { ArrivalCallAction, ArrivalCallSection } from "../types/arrivalCall";
import type { TemporaryPatientTarget } from "../types/temporaryPatient";
import { useInviteChime } from "./useInviteChime";

/** The seeded admin role (`BlueDentalAbilitySeedContributor.AdminRoleName`). */
const ADMIN_ROLE = "admin";

/**
 * The floating "Đã đến" panel (owner 2026-11-02). Who sees which list is the
 * "Bác sĩ" tick on the staff form, not a role's name; the role's Tiếp nhận
 * permissions still apply on top:
 * - ticked "Bác sĩ": only their own waiting patients, seen with Xem, called
 *   up with "Mời lên" given Sửa;
 * - not ticked: only the called-up patients, with Xem and Sửa, seated with
 *   "Tiếp nhận";
 * - an admin: both lists, for every doctor, ticked or not (owner 2026-11-02).
 * So two doctors never see each other's called-up patients. The server applies
 * the same rules; this only decides what to offer. The badge counts what still
 * waits for the viewer's click.
 *
 * A called-up "Lịch tạm" is not seated straight away: its button opens "Tạo
 * hồ sơ" first, and once the record is attached the row offers "Tiếp nhận"
 * (BA 2026-11-02). The server refuses to seat it before then.
 *
 * A patient newly on "Bác sĩ mời lên" rings a "ting ting" once (R-1144); until
 * the page has had a click the browser keeps it silent, so the dock shows a
 * muted bell and blinks for a ring it could not play (R-1145).
 */
export function useArrivalCalls() {
  const branchId = useBranchFilter();
  const isDentist = useAuthStore((s) => !!s.user?.isDentist);
  const isAdmin = useAuthStore((s) => !!s.user?.roles.includes(ADMIN_ROLE));
  const reception = useAbility("reception");
  const canCall = (isDentist || isAdmin) && reception.canRead;
  const canAdmit = (!isDentist || isAdmin) && reception.canRead && reception.canUpdate;

  const waiting = useWaitingArrivals(branchId, canCall);
  const invited = useInvitedArrivals(branchId, canAdmit);
  const inviteMutation = useInviteArrival();
  const admitMutation = useAdmitArrival();
  const [recordTarget, setRecordTarget] = useState<TemporaryPatientTarget | null>(null);
  // What this tab called up itself (an admin): no ring for one's own click.
  const selfInvited = useRef(new Set<string>()).current;
  const chime = useInviteChime(canAdmit ? invited.data : undefined, branchId, selfInvited);
  const soundUnlocked = useSoundUnlocked();

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
      selfInvited.add(id);
      inviteMutation.mutate(id, { onSuccess: () => toast.success(t("Reception:ArrivalCallInviteSuccess")) });
      return;
    }
    const walkIn = invited.data?.find((item) => item.id === id && item.isTemporary);
    if (walkIn) {
      setRecordTarget({
        appointmentId: id,
        prefill: { sourceAppointmentId: id, fullName: walkIn.patientName, phone: walkIn.patientPhone },
      });
      return;
    }
    admitMutation.mutate(id, { onSuccess: () => toast.success(t("Reception:ArrivalCallAdmitSuccess")) });
  };

  const closeRecord = () => setRecordTarget(null);

  return {
    visible: canCall || canAdmit,
    sections,
    badgeCount,
    pendingId,
    runAction,
    recordTarget,
    closeRecord,
    // The muted bell only matters to whoever the chime is for.
    soundOff: canAdmit && !soundUnlocked,
    missedChime: chime.missed,
    acknowledgeChime: chime.acknowledge,
  };
}
