namespace BlueDental.Billing;

/// <summary>
/// Data filter for money that has really changed hands. While it is on (the
/// default) a query sees only "Hoàn tất" receipts, so every rollup — the slip's
/// debt, revenue, the cash book, Dư nợ, CSKH — keeps ignoring a receipt still
/// "Chưa thanh toán" without each of them having to remember to. Code that
/// manages the receipt itself (the Thanh toán tab, edit, confirm, cancel, the
/// code sequence) turns it off with <c>DataFilter.Disable&lt;ISettleable&gt;()</c>.
/// </summary>
public interface ISettleable
{
    PatientPaymentStatus Status { get; }
}
