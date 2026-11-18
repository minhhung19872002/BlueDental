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
 * the patient list all refetch, and a toast names the bookings. A visit moved
 * along at reception by someone else refetches the same screens, silently.
 * The hub only names the branch and the bookings; everything is read back
 * through the API.
 *
 * The same socket carries e-invoices the accountant signed or cancelled on
 * EasyInvoice's portal (BA 2026-11-18): the server's sync names the branch and
 * the invoice, receipt and YC-HD screens refetch.
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

    // Someone moved a visit along at reception — arrived, called up with
    // "Mời lên", seated — so the board and the "Đã đến" panel follow.
    const handleArrivalsChanged = (branchId: string) => {
      if (branchRef.current && branchRef.current !== branchId) return;
      invalidateEntities(queryClient, ["appointment"]);
    };

    const handleEInvoicesChanged = (branchId: string) => {
      if (branchRef.current && branchRef.current !== branchId) return;
      invalidateEntities(queryClient, ["eInvoice"]);
    };

    connection.on("AppointmentsMarkedLate", handleMarkedLate);
    connection.on("ArrivalsChanged", handleArrivalsChanged);
    connection.on("EInvoicesChanged", handleEInvoicesChanged);
    // Whatever changed while the socket was down is fetched once it is back.
    connection.onreconnected(() => {
      invalidateEntities(queryClient, ["appointment", "eInvoice"]);
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
