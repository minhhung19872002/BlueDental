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
/// Whether the money on a receipt has actually been taken (BA, 2026-10-08).
/// A new payment receipt is written as "Chưa thanh toán" and only counts —
/// against the slip's debt, in revenue, the cash book, Dư nợ and e-invoices —
/// once "Xác nhận thanh toán" moves it to "Hoàn tất".
/// </summary>
public enum PatientPaymentStatus
{
    /// <summary>Chưa thanh toán — written, money not yet collected.</summary>
    Pending = 1,

    /// <summary>Hoàn tất — money collected; the receipt counts everywhere.</summary>
    Completed = 2
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
