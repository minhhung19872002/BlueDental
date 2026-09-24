namespace BlueDental.Labo;

/// <summary>
/// Why the sample was sent. Mirrors the counters on the patient's Labo tab:
/// Đơn hàng mới (<c>created</c>) · Tiếp tục công đoạn (<c>continue</c>) ·
/// Bảo hành (<c>guarantee</c>).
/// </summary>
public enum LaboOrderKind : short
{
    New = 1,
    ContinueStage = 2,
    Guarantee = 3,
    /// <summary>
    /// The reference's <c>statusClinic: canceled</c>: the clinic pulled the order
    /// back because its service line was cancelled or converted. Such an order
    /// drops out of all three counters and its Tình trạng mẫu pill reads "Đã huỷ".
    /// </summary>
    Canceled = 4
}

public enum LaboStatus : short
{
    Draft = 1,
    Sent = 2,
    InProgress = 3,
    Received = 4,
    Completed = 5,
    Rejected = 6,
    /// <summary>The reference's <c>lateDelivery</c>: "Giao trễ", set by hand on the detail dialog.</summary>
    LateDelivery = 7,
    /// <summary>The reference's <c>replaced</c>: "Đã thay thế".</summary>
    Replaced = 8
}
