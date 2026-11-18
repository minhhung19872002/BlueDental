namespace BlueDental.EInvoicing;

/// <summary>
/// Where a "Yêu cầu xuất HĐ" stands. From P1811 (BA 2026-11-18) the request
/// follows EasyInvoice: Mới → Xử lý sends it → Chờ xử lý → the accountant signs
/// on the portal (Đã xuất HĐ) or cancels it there (Đã hủy, sent again with
/// Xử lý lại). "Cần xử lý" on the screen is <see cref="Pending"/> and
/// <see cref="Cancelled"/> together. Value 3 (the old "Cần bổ sung") is retired.
/// </summary>
public enum InvoiceRequestStatus
{
    /// <summary>Mới — made by staff or by the customer through the QR; not sent yet.</summary>
    Pending = 1,

    /// <summary>Chờ xử lý — sent to EasyInvoice, waiting for the accountant to sign it there.</summary>
    Processing = 2,

    /// <summary>Đã xuất HĐ — the e-invoice was signed; the receipt is locked.</summary>
    Issued = 4,

    /// <summary>Đã hủy — the e-invoice was cancelled on EasyInvoice; it can be sent again.</summary>
    Cancelled = 5,

    /// <summary>Đã hủy yêu cầu — the request itself was dropped; the receipt is free for a new one.</summary>
    Withdrawn = 6
}

/// <summary>Who filled the request in.</summary>
public enum InvoiceRequestSource
{
    /// <summary>The customer, through the QR printed on the PHIẾU THU.</summary>
    CustomerQr = 1,

    /// <summary>Staff, with "Tạo yêu cầu xuất HĐ".</summary>
    Staff = 2,

    /// <summary>The customer, on the iPad while checking the receipt (P2610).</summary>
    SigningDevice = 3
}
