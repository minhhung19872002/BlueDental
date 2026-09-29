namespace BlueDental.EInvoicing;

/// <summary>
/// Where an e-invoice stands at the provider, as BlueDental last heard it.
///
/// EasyInvoice's own <c>InvoiceStatus</c> is kept raw on the row; this is the
/// three-way reading every screen needs. The sandbox has no signing device, so
/// today every invoice BlueDental creates stays <see cref="Draft"/> until the
/// accountant signs it on the provider's portal.
/// </summary>
public enum ElectronicInvoiceStatus
{
    /// <summary>Created at the provider, not yet signed / numbered.</summary>
    Draft = 0,

    /// <summary>Signed and numbered by the provider.</summary>
    Published = 1,

    /// <summary>Cancelled at the provider.</summary>
    Cancelled = 2
}
