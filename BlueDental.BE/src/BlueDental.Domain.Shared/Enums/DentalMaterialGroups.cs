namespace BlueDental.Catalogs;

/// <summary>
/// The groups of "Vật liệu nha khoa" (clinic, 2026-10-16): fixed for now — one
/// per kind, made for a branch the first time its list is read, and not to be
/// added to, renamed or deleted. Each is told by its <c>SubGroup</c>, which is
/// also what decides the kind of the materials filed under it.
/// </summary>
public static class DentalMaterialGroups
{
    public const string Crown = "crown";
    public const string Implant = "implant";

    /// <summary>The fixed groups, in their order: sub-group, name.</summary>
    public static readonly (string SubGroup, string Name)[] All =
    [
        (Crown, "Răng sứ"),
        (Implant, "Răng Implant"),
    ];

    public static RestorationKind KindOf(string? subGroup) =>
        subGroup == Implant ? RestorationKind.Implant : RestorationKind.Crown;
}
