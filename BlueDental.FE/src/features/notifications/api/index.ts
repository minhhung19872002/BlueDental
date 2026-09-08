import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import { api } from "@/lib/axios";
import { t } from "@/lib/i18n";

import {
  DeliveryStatus,
  NotificationType,
  type NotificationDto,
  type NotificationViewModel,
} from "../types";

interface NotifListResult {
  items: NotificationDto[];
  totalCount: number;
}

const BASE = "/v1/app/notifications";

/** Where each kind of notification takes you; null means it has no screen. */
const ROUTE_BY_TYPE: Record<NotificationType, string | null> = {
  [NotificationType.AppointmentReminder]: "/calendar",
  [NotificationType.AppointmentConfirmation]: "/calendar",
  [NotificationType.AppointmentCancellation]: "/calendar",
  [NotificationType.TreatmentPlanApproval]: "/patient",
  [NotificationType.InvoiceIssued]: "/billing",
  [NotificationType.PaymentReceived]: "/billing",
  [NotificationType.InsuranceClaimUpdate]: "/billing",
  [NotificationType.StockAlert]: "/materials",
  [NotificationType.SystemAlert]: null,
};

/**
 * "5 phút trước", rather than a timestamp nobody subtracts in their head.
 *
 * Written out instead of dayjs's relativeTime plugin because that plugin reads
 * dayjs's global locale, and setting that to Vietnamese would re-word every
 * formatted date in the app.
 */
function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return t("Vừa xong");
  if (minutes < 60) return t("{0} phút trước", minutes);

  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("{0} giờ trước", hours);

  const days = Math.round(hours / 24);
  if (days === 1) return t("Hôm qua");
  if (days < 7) return t("{0} ngày trước", days);

  return dayjs(iso).format("DD/MM/YYYY");
}

function adaptNotification(dto: NotificationDto): NotificationViewModel {
  return {
    id: dto.id,
    type: dto.type,
    title: dto.subject,
    body: dto.body,
    isRead: dto.deliveryStatus === DeliveryStatus.Read,
    time: relativeTime(dto.sentAt),
    route: ROUTE_BY_TYPE[dto.type] ?? null,
  };
}

export function useMyNotifications() {
  return useQuery({
    queryKey: ["notifications", "my"],
    queryFn: () =>
      api.get<NotifListResult>(BASE, { params: { maxResultCount: 20 } }).then((r) => ({
        items: r.data.items.map(adaptNotification),
        totalCount: r.data.totalCount,
      })),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`${BASE}/${id}/read`).then(() => undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`${BASE}/read-all`).then(() => undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
