namespace BlueDental.Promotions;

public static class VoucherConsts
{
    /// <summary>
    /// Prefix shown before every voucher code. The reference only ever showed
    /// "HN-" and its origin is unobserved (likely per-clinic — see
    /// docs/clone/unknowns.md); until that is known the server owns this value
    /// and the client fetches it instead of inventing its own.
    /// </summary>
    public const string DefaultPrefix = "HN";

    public const int GeneratedCodeLength = 8;

    /// <summary>Uppercase alphabet without the look-alikes I, O, 0 and 1.</summary>
    public const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
}
