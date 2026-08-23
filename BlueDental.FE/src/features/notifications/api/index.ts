import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

export interface NotificationDto {
  id: string;
  message: string;
  type: string;
  isRead: boolean;
  creationTime: string;
  entityId?: string;
  entityType?: string;
}

interface NotifListResult {
  items: NotificationDto[];
  totalCount: number;
}

const BASE = "/v1/app/notifications";

export function useMyNotifications() {
  return useQuery({
    queryKey: ["notifications", "my"],
    queryFn: () =>
      api.get<NotifListResult>(BASE, { params: { maxResultCount: 20 } }).then((r) => r.data),
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
