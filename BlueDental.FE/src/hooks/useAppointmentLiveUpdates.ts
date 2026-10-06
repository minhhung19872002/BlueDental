import { useEffect, useRef } from "react";
import { HubConnectionState } from "@microsoft/signalr";
import { useQueryClient, type Query } from "@tanstack/react-query";

import { useBranchFilter } from "@/lib/clinicBranch";
import { createNotificationConnection } from "@/lib/signalr";

/** The query families that show an appointment's status (lịch hẹn, tiếp đón, CSKH). */
const APPOINTMENT_QUERY_ROOTS: ReadonlySet<string> = new Set([
  "appointments",
  "appointment-history",
  "receptions",
  "receptionMetrics",
  "care-records",
]);

const showsAppointments = (query: Query) =>
  typeof query.queryKey[0] === "string" && APPOINTMENT_QUERY_ROOTS.has(query.queryKey[0]);

/**
 * Keeps open screens current when the server changes appointments on its own —
 * a booking turning Trễ hẹn once its time passes — instead of waiting for a
 * reload. The hub only names the branch; the refetch goes through the API.
 */
export function useAppointmentLiveUpdates(enabled: boolean): void {
  const queryClient = useQueryClient();
  const branchFilter = useBranchFilter();
  const branchRef = useRef(branchFilter);
  branchRef.current = branchFilter;

  useEffect(() => {
    if (!enabled) return;

    const connection = createNotificationConnection();
    const handleAppointmentsChanged = (branchId: string) => {
      // `undefined` is "Tất cả chi nhánh": every branch's change shows.
      if (branchRef.current && branchRef.current !== branchId) return;
      void queryClient.invalidateQueries({ predicate: showsAppointments });
    };

    connection.on("AppointmentsChanged", handleAppointmentsChanged);
    // Whatever changed while the socket was down is fetched once it is back.
    connection.onreconnected(() => {
      void queryClient.invalidateQueries({ predicate: showsAppointments });
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
