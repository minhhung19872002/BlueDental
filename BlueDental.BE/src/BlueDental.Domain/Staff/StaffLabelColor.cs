using System.Text.RegularExpressions;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.Identity;

namespace BlueDental.Staff;

/// <summary>
/// "Màu nhãn" of a staff member (R-1155): the colour their name is worn in on
/// the Tiếp nhận card, the Khách đã đến / Bác sĩ mời lên panel, the Lịch hẹn
/// day-view column head and the staff list. "#RRGGBB" upper case, kept as an
/// extra property of the IdentityUser; null means the default colour, which
/// the screens draw.
/// </summary>
public static class StaffLabelColor
{
    public const string PropertyName = "LabelColor";

    private static readonly Regex HexColor = new("^#[0-9A-Fa-f]{6}$", RegexOptions.Compiled);

    public static string? Read(IdentityUser user) =>
        user.ExtraProperties.GetOrDefault(PropertyName) as string;

    /// <summary>Blank clears the colour back to the default.</summary>
    public static void Write(IdentityUser user, string? color)
    {
        if (string.IsNullOrWhiteSpace(color))
        {
            user.ExtraProperties[PropertyName] = null;
            return;
        }

        if (!HexColor.IsMatch(color))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.InvalidLabelColor)
                .WithData("Color", color);
        }

        user.ExtraProperties[PropertyName] = color.ToUpperInvariant();
    }
}
