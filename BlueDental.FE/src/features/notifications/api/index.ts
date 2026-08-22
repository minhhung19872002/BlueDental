import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  creationTime: string;
  type: string;
}

const notificationApi = {
  list: (): Promise<{ items: NotificationDto[]; totalCount: number }> =>
    api.get("/v1/app/notifications", { params: { maxResultCount: 50 } }).then((r) => r.data),

  markRead: (id: string): Promise<void> =>
    api.post(`/v1/app/notifications/${id}/read`).then(() => undefined),

  markAllRead: (): Promise<void> =>
    api.post("/v1/app/notifications/read-all").then(() => undefined),
};

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationApi.list(),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
