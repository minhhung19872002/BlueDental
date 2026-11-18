namespace BlueDental.EInvoicing;

/// <summary>
/// Where an e-invoice stands, as BlueDental last heard it (BA 2026-11-18):
/// Lưu Nháp keeps it in BlueDental (<see cref="NotSent"/>); Lưu sends it to
/// EasyInvoice unsigned (<see cref="Draft"/>, "Chờ kiểm tra"); the accountant
/// signs it on the provider's portal and the sync reads it back
/// (<see cref="Published"/>, "Đã xuất hóa đơn").
///
/// EasyInvoice's own <c>InvoiceStatus</c> is kept raw on the row; this is the
/// reading every screen needs.
/// </summary>
public enum ElectronicInvoiceStatus
{
    /// <summary>At the provider, not yet signed / numbered — "Chờ kiểm tra".</summary>
    Draft = 0,

    /// <summary>Signed and numbered by the provider — "Đã xuất hóa đơn".</summary>
    Published = 1,

    /// <summary>Cancelled at the provider.</summary>
    Cancelled = 2,

    /// <summary>Signed, then superseded by a replacement invoice (provider status 3).</summary>
    Replaced = 3,

    /// <summary>Signed, then corrected by an adjustment invoice (provider status 4).</summary>
    Adjusted = 4,

    /// <summary>Saved in BlueDental only (Lưu Nháp); nothing was sent — "Nháp".</summary>
    NotSent = 5
}
