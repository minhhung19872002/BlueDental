namespace BlueDental.Catalogs;

/// <summary>
/// Which kind of account a payment method points at. The reference's
/// "BE:Common:PaymentMethod" screen offers exactly these two tabs.
/// </summary>
public enum PaymentAccountKind
{
    MoMo = 1,
    Bank = 2
}
