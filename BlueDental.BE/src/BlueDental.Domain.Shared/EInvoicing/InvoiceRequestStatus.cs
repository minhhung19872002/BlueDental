namespace BlueDental.EInvoicing;

/// <summary>
/// Where a "Yêu cầu xuất HĐ" stands with the accountant (BA mockup 2026-10-12).
/// "Cần xử lý" on the screen is <see cref="Pending"/>, <see cref="Processing"/>
/// and <see cref="NeedsInfo"/> together.
/// </summary>
public enum InvoiceRequestStatus
{
    /// <summary>Chờ xử lý — nobody has picked it up yet.</summary>
    Pending = 1,

    /// <summary>Đang xử lý — an accountant claimed it.</summary>
    Processing = 2,

    /// <summary>Cần bổ sung — sent back with a reason; the clock stops.</summary>
    NeedsInfo = 3,

    /// <summary>Đã xuất HĐ — the accountant recorded the invoice number.</summary>
    Issued = 4,

    /// <summary>Đã hủy.</summary>
    Cancelled = 5
}

/// <summary>Who filled the request in.</summary>
public enum InvoiceRequestSource
{
    /// <summary>The customer, through the QR printed on the PHIẾU THU.</summary>
    CustomerQr = 1,

    /// <summary>Staff, with "Tạo yêu cầu xuất HĐ".</summary>
    Staff = 2
}
