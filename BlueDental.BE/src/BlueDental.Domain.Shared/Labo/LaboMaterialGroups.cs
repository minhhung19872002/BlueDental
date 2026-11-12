namespace BlueDental.Labo;

/// <summary>
/// The groups of "Dịch vụ Labo" (BA P1011, renamed P1311): three fixed groups
/// per branch, plus the ones the branch adds (P1311), each a Dịch vụ of the
/// Phiếu yêu cầu — one Dịch vụ, then any of its Vật liệu, no "Trên implant".
/// A group is told by its code, kept in the taxonomy row's <c>SubGroup</c>:
/// a fixed code, or <see cref="Added"/> for one the branch made.
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

    /// <summary>
    /// A Dịch vụ the branch added on the Dịch vụ Labo tab (P1311). The server
    /// stamps it on create, so it is how the tab tells such a group from one
    /// made before P1011.
    /// </summary>
    public const string Added = "DICH_VU";

    public static bool IsFixed(string? code) =>
        code is AllCeramic or Alloy or OtherOnImplant;
}
