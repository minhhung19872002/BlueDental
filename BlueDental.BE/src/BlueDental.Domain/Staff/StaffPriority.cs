using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.Identity;

namespace BlueDental.Staff;

/// <summary>
/// "Mức độ ưu tiên" of a staff member, typed on the staff form the way a
/// catalogue row's is: 0 by default, a lower number comes first. The reception
/// board lists the doctors it is filtered by in this order. Kept as an extra
/// property of the IdentityUser.
/// </summary>
public static class StaffPriority
{
    public const string PropertyName = "Priority";
    public const int Min = 0;

    private static readonly StringComparer VietnameseOrder =
        StringComparer.Create(CultureInfo.GetCultureInfo("vi-VN"), true);

    /// <summary>Never set (staff saved before the field existed) reads as 0.</summary>
    public static int Read(IdentityUser user) =>
        int.TryParse(user.ExtraProperties.GetOrDefault(PropertyName)?.ToString(), out var value) ? value : Min;

    public static void Write(IdentityUser user, int priority)
    {
        if (priority < Min)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.InvalidPriority);
        }

        user.ExtraProperties[PropertyName] = priority;
    }

    /// <summary>Lowest number first; a tie goes by name.</summary>
    public static IEnumerable<IdentityUser> Order(IEnumerable<IdentityUser> users) =>
        users
            .OrderBy(Read)
            .ThenBy(u => u.Name ?? u.UserName, VietnameseOrder);
}
