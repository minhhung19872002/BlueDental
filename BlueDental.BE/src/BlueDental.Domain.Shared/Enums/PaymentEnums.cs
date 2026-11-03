namespace BlueDental.Billing;

/// <summary>
/// How money moved.
///
/// The reference's payment rollup splits by <c>cash | banking | card |
/// outstandingDebt</c>, but its "BE:Perm:CreatePayment" dialog offers a fifth —
/// "BE:PaymentKind:Momo" — so the enum carries it and the clinic report gives it a bucket
/// of its own rather than letting e-wallet money fall out of the totals.
/// </summary>
public enum PaymentMethodKind
{
    Cash = 1,
    Banking = 2,
    Card = 3,

    /// <summary>Settled against the patient's outstanding debt rather than by cash.</summary>
    OutstandingDebt = 4,

    /// <summary>Ví điện tử — the reference names MoMo.</summary>
    EWallet = 5
}

/// <summary>
/// How a receipt's total is spread over the services it covers — the
/// reference's "BE:Treatment:AutoSplit" / "BE:Treatment:ManualSplit".
/// </summary>
public enum PaymentSplitMode
{
    /// <summary>The server spreads the total, oldest line first, capped per line.</summary>
    Auto = 1,

    /// <summary>The cashier typed an amount for each line.</summary>
    Manual = 2
}

/// <summary>
/// Where a receipt is on its way from the counter to the cash drawer (P2610,
/// owner 2026-10-27). A receipt only counts — against the slip's debt, in
/// revenue, the cash book, Dư nợ and e-invoices — once it is "Đã thanh toán";
/// see <c>ISettleable</c>. A new receipt starts "Chưa thanh toán", the customer
/// checks and signs it on the iPad, the accountant exports it ("Đã xuất phiếu
/// thu") and later ticks ✓ on the slip's Thanh toán tab once the money is in.
/// The numbers 1 and 2 predate that flow and keep their meaning.
/// </summary>
public enum PatientPaymentStatus
{
    /// <summary>Chưa thanh toán — written, not yet exported; still editable.</summary>
    Pending = 1,

    /// <summary>Đã thanh toán — money collected; the receipt counts everywhere.</summary>
    Completed = 2,

    /// <summary>Đã xuất phiếu thu — signed and exported; locked, money not yet confirmed.</summary>
    Issued = 3,

    /// <summary>Phiếu bị hủy — kept for the record, counted nowhere.</summary>
    Cancelled = 4
}

/// <summary>
/// Lý do hủy phiếu thu — the four fixed choices of the cancel page (P2610),
/// each given with a free-text description.
/// </summary>
public enum PaymentCancelReason
{
    /// <summary>Sai thông tin người nộp.</summary>
    WrongPayer = 1,

    /// <summary>Sai số tiền / dịch vụ.</summary>
    WrongAmountOrService = 2,

    /// <summary>Lập trùng phiếu.</summary>
    Duplicate = 3,

    /// <summary>Lý do khác.</summary>
    Other = 4
}

/// <summary>
/// Direction of a patient money movement.
/// </summary>
public enum PatientPaymentKind
{
    /// <summary>Thu tiền — money in.</summary>
    Payment = 1,

    /// <summary>Hoàn tiền — money back to the patient.</summary>
    Refund = 2,

    /// <summary>
    /// Nạp quỹ khách — money the clinic holds for the patient before it is spent
    /// on a slip. The reference shows this as "BE:PaymentKind:HeldForCustomer".
    /// </summary>
    Prepaid = 3
}

/// <summary>
/// Why an iPad signing session (P2610) ended. Only <see cref="Issued"/> is a
/// success: the iPad then says "Phiếu thu đã được xuất".
/// </summary>
public enum SigningCloseReason
{
    /// <summary>Hủy phiên &amp; sửa phiếu — the cashier took the iPad back.</summary>
    Cancelled = 1,

    /// <summary>The receipt was exported.</summary>
    Issued = 2,

    /// <summary>The receipt itself was cancelled.</summary>
    ReceiptCancelled = 3,

    /// <summary>The receipt was edited, so what the customer saw is out of date.</summary>
    Revised = 4,

    /// <summary>Another receipt was sent to the iPad in its place.</summary>
    Replaced = 5,

    /// <summary>
    /// "In phiếu thu" (P2910_02): the customer signs the printed draft at the
    /// counter instead, and the iPad says "Phiếu thu đã được in".
    /// </summary>
    Printed = 6
}

/// <summary>
/// The accountant's choice on "Xuất phiếu thu" (P2610, renamed by P2910_02).
/// The BA sets no default: the export waits until one is picked.
/// </summary>
public enum ReceiptSignMode
{
    /// <summary>
    /// Ký tay trực tiếp (was "Không ký số") — nothing of the accountant's is
    /// added; they sign the printed receipt by hand.
    /// </summary>
    Unsigned = 1,

    /// <summary>Token điện tử — the accountant's USB token signs the PDF (phase 7; refused until then).</summary>
    Digital = 2,

    /// <summary>Ký điện tử — the accountant's saved signature image goes above "Người lập phiếu".</summary>
    Electronic = 3
}

/// <summary>How an accountant's Ký điện tử signature was made (P2910_02).</summary>
public enum AccountantSignatureSource
{
    /// <summary>Drawn on the pad with a mouse, pen or signing tablet.</summary>
    Drawn = 1,

    /// <summary>"Tải ảnh lên", kept from "Dùng chữ ký này".</summary>
    Uploaded = 2
}

/// <summary>
/// One line of a receipt's log (P2910_02 BA note on "Xuất phiếu thu"): what
/// happened, by whom and when. Written once, never edited.
/// </summary>
public enum ReceiptLogAction
{
    /// <summary>"In phiếu thu" → Xác nhận in: the customer signs the printout by hand.</summary>
    PrintedForPaper = 1,

    /// <summary>"Hủy phiên &amp; sửa phiếu" or an edit took the receipt back from paper.</summary>
    PaperTakenBack = 2,

    /// <summary>"Xuất phiếu thu": the PDF was written, sealed and stored.</summary>
    Exported = 3,

    /// <summary>"Hủy phiếu thu".</summary>
    Cancelled = 4
}
