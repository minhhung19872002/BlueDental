namespace BlueDental.Labo;

/// <summary>
/// Why the sample was sent. Mirrors the counters on the patient's Labo tab:
/// Đơn hàng mới (<c>created</c>) · Tiếp tục công đoạn (<c>continue</c>) ·
/// Bảo hành (<c>guarantee</c>).
///
/// Since P2910_03 every new order is <see cref="New"/>: the child orders of
/// Làm tiếp công đoạn / Bảo hành are no longer raised, but the old ones still
/// read back with their kind.
/// </summary>
public enum LaboOrderKind : short
{
    New = 1,
    ContinueStage = 2,
    Guarantee = 3,
    /// <summary>
    /// The reference's <c>statusClinic: canceled</c>: the clinic pulled the order
    /// back because its service line was cancelled or converted. Rows written
    /// before P2910_03 only; a cancelled order now reads off its status.
    /// </summary>
    Canceled = 4
}

/// <summary>
/// The order's step in the P2910_03 workflow (BA state machine, 2026-10-30):
/// Nháp → Đã gửi Labo → Chờ kiểm tra → Hoàn thành / Trả hàng → … → Bảo hành.
/// "Hết hạn bảo hành" is not stored: it is <see cref="Warranty"/> once every
/// activated tooth is past its end date, worked out when the order is read.
/// </summary>
public enum LaboStatus : short
{
    /// <summary>Nháp — Lưu nháp, still editable.</summary>
    Draft = 1,
    /// <summary>Đã gửi Labo — Tạo phiếu Labo pressed, the order form is locked.</summary>
    Sent = 2,
    /// <summary>Chờ kiểm tra — the goods are in, the per-tooth check is open.</summary>
    AwaitingCheck = 3,
    /// <summary>Trả hàng — sent back to the lab, waiting for the next delivery.</summary>
    Returned = 4,
    /// <summary>Hoàn thành — every tooth passed the check.</summary>
    Completed = 5,
    /// <summary>Đã hủy — the order stays listed, it only changes status.</summary>
    Cancelled = 6,
    /// <summary>Bảo hành — at least one tooth's warranty is activated.</summary>
    Warranty = 7
}

/// <summary>A tooth's standing result: what the clinic has accepted so far.</summary>
public enum LaboToothCheckResult : short
{
    /// <summary>Not checked yet, or back from the lab for another check.</summary>
    None = 0,
    Passed = 1,
    Failed = 2
}

/// <summary>How one receive-and-check round ended.</summary>
public enum LaboRoundOutcome : short
{
    /// <summary>Received, the check not saved yet.</summary>
    Pending = 0,
    /// <summary>Xác nhận Labo đạt.</summary>
    Passed = 1,
    /// <summary>Trả toàn bộ — every tooth goes back and is checked again.</summary>
    ReturnedAll = 2,
    /// <summary>Trả hàng bị lỗi — only the failed teeth go back.</summary>
    ReturnedDefective = 3
}
