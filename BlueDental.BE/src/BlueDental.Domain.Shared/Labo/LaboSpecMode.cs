namespace BlueDental.Labo;

/// <summary>
/// The two switches above "Thông số từng răng" (Labo v2, R-1150):
/// Thông số răng Chung / Riêng, and — while it is Chung — Màu răng Chung / Riêng.
/// The values are still stored on every tooth; the mode says how the form
/// shows them.
/// </summary>
public enum LaboSpecMode : short
{
    /// <summary>Chung thông số · chung màu: one Tất cả row holds everything.</summary>
    SharedAll = 1,

    /// <summary>Chung thông số · riêng màu: Đường hoàn tất / Kiểu nhịp shared, Màu răng per tooth.</summary>
    SharedSpecOwnShade = 2,

    /// <summary>Riêng từng răng: every tooth its own values.</summary>
    PerTooth = 3
}
