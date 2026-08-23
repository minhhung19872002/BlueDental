namespace BlueDental.CustomerCare;

/// <summary>
/// Where a care task stands. The reference's grouping screen counts
/// Tổng khách · Thành công · Thất bại · Chưa CS · Đã gửi Zalo, and a record was
/// observed carrying <c>status: "new"</c>.
/// </summary>
public enum CareStatus : short
{
    /// <summary>Chưa chăm sóc — the reference's <c>new</c>.</summary>
    New = 1,

    /// <summary>Đã liên hệ, chờ kết quả.</summary>
    Contacted = 2,

    /// <summary>Thành công.</summary>
    Succeeded = 3,

    /// <summary>Thất bại (không liên hệ được, khách từ chối...).</summary>
    Failed = 4,

    /// <summary>Đã huỷ.</summary>
    Cancelled = 5
}

/// <summary>
/// "Đánh giá" on the patient's care tab: Tốt · Khá · Bình thường · Khiếu nại.
/// </summary>
public enum CareOutcome : short
{
    NotRated = 0,
    Good = 1,
    Fair = 2,
    Normal = 3,
    Complaint = 4
}
