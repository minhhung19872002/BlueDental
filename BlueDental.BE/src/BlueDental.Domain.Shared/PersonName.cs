using System.Text.RegularExpressions;

namespace BlueDental;

/// <summary>
/// The characters a person's name may hold: letters (Vietnamese marks
/// included), digits, spaces and - . ' (owner 2026-10-07, bug list item 30).
/// Mirrored by <c>PERSON_NAME_PATTERN</c> in the frontend.
/// </summary>
public static partial class PersonName
{
    public static bool IsValid(string? name) =>
        !string.IsNullOrWhiteSpace(name) && Pattern().IsMatch(name);

    [GeneratedRegex(@"^[\p{L}\p{M}0-9 .'\-]+$")]
    private static partial Regex Pattern();
}
