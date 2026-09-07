namespace BlueDental.Billing;

/// <summary>
/// How money moved.
///
/// The reference's payment rollup splits by <c>cash | banking | card |
/// outstandingDebt</c>, but its "Tạo phiếu thanh toán" dialog offers a fifth —
/// "Ví momo" — so the enum carries it and the clinic report gives it a bucket
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
/// reference's "Chia Tiền Tự Động" / "Chia Tiền Thủ Công".
/// </summary>
public enum PaymentSplitMode
{
    /// <summary>The server spreads the total, oldest line first, capped per line.</summary>
    Auto = 1,

    /// <summary>The cashier typed an amount for each line.</summary>
    Manual = 2
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
    /// on a slip. The reference shows this as "Đang Giữ Hộ Khách".
    /// </summary>
    Prepaid = 3
}
