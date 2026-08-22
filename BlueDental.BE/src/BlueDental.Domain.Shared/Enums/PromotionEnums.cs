namespace BlueDental.Promotions;

/// <summary>
/// Voucher lifecycle — reference stats bar on <c>/voucher</c>:
/// Tổng voucher / Đang hoạt động / Đã phát hành / Đã hết hạn.
/// </summary>
public enum VoucherStatus
{
    /// <summary>Nháp — not usable yet.</summary>
    Draft = 1,

    /// <summary>Đang hoạt động.</summary>
    Active = 2,

    /// <summary>Tạm dừng.</summary>
    Paused = 3,

    /// <summary>Hết hạn hoặc dùng hết lượt.</summary>
    Expired = 4
}

/// <summary>
/// Who a voucher may be applied to — reference query
/// <c>/voucher/available?customerTarget=returning</c>.
/// </summary>
public enum VoucherCustomerTarget
{
    All = 0,

    /// <summary>Khách mới.</summary>
    New = 1,

    /// <summary>Khách cũ / tái khám.</summary>
    Returning = 2
}
