namespace BlueDental.Billing;

/// <summary>
/// How money moved. Observed on the reference's payment rollup, which splits every
/// figure by <c>cash | banking | card | outstandingDebt</c> — nothing else appears.
/// </summary>
public enum PaymentMethodKind
{
    Cash = 1,
    Banking = 2,
    Card = 3,

    /// <summary>Settled against the patient's outstanding debt rather than by cash.</summary>
    OutstandingDebt = 4
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
