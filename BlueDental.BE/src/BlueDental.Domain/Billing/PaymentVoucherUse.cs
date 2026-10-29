using System;

namespace BlueDental.Billing;

/// <summary>
/// The voucher a receipt is written with (P2910): which one, and its code as
/// the receipt prints it. What it takes off rides on the lines' voucher shares.
/// </summary>
public sealed record PaymentVoucherUse(Guid VoucherId, string Code);
