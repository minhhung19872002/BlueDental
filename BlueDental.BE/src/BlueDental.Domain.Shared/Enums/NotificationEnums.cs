namespace BlueDental.Notifications;

public enum NotificationType
{
    AppointmentReminder = 1,
    AppointmentConfirmation = 2,
    AppointmentCancellation = 3,
    TreatmentPlanApproval = 4,
    InvoiceIssued = 5,
    PaymentReceived = 6,
    InsuranceClaimUpdate = 7,
    StockAlert = 8,
    SystemAlert = 9
}

public enum NotificationChannel
{
    InApp = 1,
    Email = 2,
    Sms = 3,
    Push = 4
}

public enum DeliveryStatus
{
    Pending = 1,
    Sent = 2,
    Delivered = 3,
    Read = 4,
    Failed = 5
}
