namespace BlueDental.Labo;

/// <summary>
/// The groups of "Vật liệu &amp; loại phục hình" (BA P1011): three fixed groups
/// per branch, each one table of the Phiếu yêu cầu. A group is told by its code,
/// kept in the taxonomy row's <c>SubGroup</c>; the code also decides which
/// columns the slip offers for the materials filed under it.
///
/// Groups made before P1011 stay in the database — orders of the old form
/// still name their materials — but neither the catalog nor the slip lists them.
/// </summary>
public static class LaboMaterialGroups
{
    /// <summary>Toàn sứ: a plain column and a "Trên implant" column.</summary>
    public const string AllCeramic = "TOAN_SU";

    /// <summary>Hợp kim: a plain column and a "Trên implant" column.</summary>
    public const string Alloy = "HOP_KIM";

    /// <summary>Phục hình khác trên implant: one column, every tick is on an implant.</summary>
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

    /// <summary>
    /// The card of the Phiếu yêu cầu a group's materials sit on (R-1202): a
    /// group made before P1011 shares Phục hình khác trên implant.
    /// </summary>
    public static LaboFormBlockKind CardOf(string? code) => code switch
    {
        AllCeramic => LaboFormBlockKind.AllCeramic,
        Alloy => LaboFormBlockKind.Alloy,
        _ => LaboFormBlockKind.OtherOnImplant,
    };

    /// <summary>
    /// Whether a material of the group may be ticked as it is, or on an implant.
    /// A group made before P1011 keeps the material's own "Có lựa chọn Trên
    /// implant" flag, so an old order still saves the way it was written.
    /// </summary>
    public static bool Accepts(string? code, bool onImplant, bool legacyAllowOnImplant) => code switch
    {
        AllCeramic or Alloy => true,
        OtherOnImplant => onImplant,
        _ => !onImplant || legacyAllowOnImplant,
    };
}
