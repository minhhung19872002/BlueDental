// TODO: Define notification types.

export type NotificationType =
  | "appointment_reminder"
  | "appointment_cancelled"
  | "payment_received"
  | "low_stock"
  | "system";

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  entityId: string | null;
  entityType: string | null;
}
