namespace BlueDental.PrepaidCards;

/// <summary>
/// Where an issued Thẻ trả trước stands (function list cụm 3). BlueDental-local:
/// the reference has no prepaid cards (docs/clone/pages/prepaid-card.md).
/// "Hết giá trị" / "Hết lượt" are not stored — they are read off the balance
/// and the use count.
/// </summary>
public enum PrepaidCardStatus : short
{
    /// <summary>Đang hoạt động — can be topped up and spent.</summary>
    Active = 1,

    /// <summary>Tạm khoá — nothing can be spent or loaded until it is unlocked.</summary>
    Locked = 2,

    /// <summary>Đã huỷ — a sale undone before the card was ever used; final.</summary>
    Cancelled = 3,
}

/// <summary>"Hoa hồng khi bán" — a share of the sale price or a fixed amount.</summary>
public enum PrepaidCardCommissionType : short
{
    /// <summary>% of the price the card was sold for.</summary>
    Percent = 1,

    /// <summary>A fixed VNĐ amount per card sold.</summary>
    Amount = 2,
}

/// <summary>One line of a card's ledger.</summary>
public enum PrepaidCardTransactionType : short
{
    /// <summary>Phát hành — the card was sold and loaded with its usage value.</summary>
    Issue = 1,

    /// <summary>Nạp thêm — usage value added to the card.</summary>
    Topup = 2,

    /// <summary>Sử dụng — a payment receipt was paid from the card.</summary>
    Use = 3,

    /// <summary>
    /// Hoàn lại — the receipt paid from the card was cancelled or changed, or
    /// money refunded on services the card paid went back onto it.
    /// </summary>
    Refund = 4,

    /// <summary>Huỷ thẻ — the remaining value is written off and the money taken is given back.</summary>
    Cancel = 5,
}
