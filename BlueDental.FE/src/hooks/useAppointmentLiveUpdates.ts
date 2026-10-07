import { useEffect, useRef } from "react";
import { HubConnectionState } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";

import { announceLateAppointments } from "@/hooks/lateAppointmentNotice";
import { useBranchFilter } from "@/lib/clinicBranch";
import { invalidateEntities } from "@/lib/queryEntities";
import { createNotificationConnection } from "@/lib/signalr";

/**
 * Keeps open screens current when the server changes appointments on its own —
 * a booking turning Trễ hẹn once its time passes — instead of waiting for a
 * reload: Lịch hẹn, Tiếp nhận, CSKH (Nhắc lịch hẹn → Đặt lịch không đến) and
 * the patient list all refetch, and a toast names the bookings. The hub only
 * names the branch and the bookings; everything is read back through the API.
 */
export function useAppointmentLiveUpdates(enabled: boolean): void {
  const queryClient = useQueryClient();
  const branchFilter = useBranchFilter();
  const branchRef = useRef(branchFilter);
  branchRef.current = branchFilter;

  useEffect(() => {
    if (!enabled) return;

    const connection = createNotificationConnection();
    const handleMarkedLate = (branchId: string, appointmentIds: string[]) => {
      // `undefined` is "Tất cả chi nhánh": every branch's change shows.
      if (branchRef.current && branchRef.current !== branchId) return;
      invalidateEntities(queryClient, ["appointment"]);
      void announceLateAppointments(appointmentIds);
    };

    connection.on("AppointmentsMarkedLate", handleMarkedLate);
    // Whatever changed while the socket was down is fetched once it is back.
    connection.onreconnected(() => {
      invalidateEntities(queryClient, ["appointment"]);
    });
    connection.start().catch((error: unknown) => {
      console.warn("Appointment live updates unavailable:", error);
    });

    return () => {
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop();
      }
    };
  }, [enabled, queryClient]);
}
