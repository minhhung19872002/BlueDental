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
    Guarantee = 3
}

public enum LaboStatus : short
{
    Draft = 1,
    Sent = 2,
    InProgress = 3,
    Received = 4,
    Completed = 5,
    Rejected = 6
}
