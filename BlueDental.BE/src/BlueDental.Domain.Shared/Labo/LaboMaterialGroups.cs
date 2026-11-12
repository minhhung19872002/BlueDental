namespace BlueDental.Labo;

/// <summary>
/// The groups of "Vật liệu &amp; loại phục hình" (BA P1011): three fixed groups
/// per branch, each a Dịch vụ of the Phiếu yêu cầu's Loại phục hình — one
/// Dịch vụ, then one of its Vật liệu, no "Trên implant" (R-1216). A group is
/// told by its code, kept in the taxonomy row's <c>SubGroup</c>.
///
/// Groups made before P1011 stay in the database — orders of the old form
/// still name their materials — but neither the catalog nor the slip lists them.
/// </summary>
public static class LaboMaterialGroups
{
    /// <summary>Toàn sứ.</summary>
    public const string AllCeramic = "TOAN_SU";

    /// <summary>Hợp kim.</summary>
    public const string Alloy = "HOP_KIM";

    /// <summary>Phục hình khác trên implant — a Dịch vụ like the other two since R-1216.</summary>
    public const string OtherOnImplant = "KHAC_TREN_IMPLANT";

    /// <summary>The fixed groups, in their order: code, name.</summary>
    public static readonly (string Code, string Name)[] All =
    [
        (AllCeramic, "Toàn sứ"),
        (Alloy, "Hợp kim"),
        (OtherOnImplant, "Phục hình khác trên implant"),
    ];

    public static bool IsFixed(string? code) =>
        code is AllCeramic or Alloy or OtherOnImplant;
}
