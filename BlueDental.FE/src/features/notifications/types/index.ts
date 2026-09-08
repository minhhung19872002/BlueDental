/** Mirrors `BlueDental.Notifications.NotificationType` on the server. */
export const NotificationType = {
  AppointmentReminder: 1,
  AppointmentConfirmation: 2,
  AppointmentCancellation: 3,
  TreatmentPlanApproval: 4,
  InvoiceIssued: 5,
  PaymentReceived: 6,
  InsuranceClaimUpdate: 7,
  StockAlert: 8,
  SystemAlert: 9,
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/** Mirrors `BlueDental.Notifications.DeliveryStatus`. */
export const DeliveryStatus = {
  Pending: 1,
  Sent: 2,
  Delivered: 3,
  Read: 4,
  Failed: 5,
} as const;

export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

/** The server's notification record, exactly as `NotificationDto` sends it. */
export interface NotificationDto {
  id: string;
  type: NotificationType;
  channel: number;
  subject: string;
  body: string;
  deliveryStatus: DeliveryStatus;
  sentAt: string | null;
  readAt: string | null;
  referenceEntityType: string | null;
  referenceEntityId: string | null;
}

/** What the bell's panel draws: the record, already read for display. */
export interface NotificationViewModel {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  /** Empty while the notification is still queued and has no send time. */
  time: string;
  /** Where clicking it goes, or null when the kind has no screen of its own. */
  route: string | null;
}
