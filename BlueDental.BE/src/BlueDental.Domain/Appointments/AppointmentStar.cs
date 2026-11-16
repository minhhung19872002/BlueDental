using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;

namespace BlueDental.Appointments;

/// <summary>
/// "Gán sao" on a booking (R-1240, BA 2026-11-16): the colour picker gave way
/// to a star the calendar prints in front of the patient's name. Each key is
/// one of the four stars the dialog offers; the screen draws its shape and
/// colour. No star is null.
/// </summary>
public static class AppointmentStar
{
    public const int MaxLength = 16;

    public const string Purple = "purple";
    public const string Green = "green";
    public const string Orange = "orange";
    public const string Red = "red";

    public static readonly IReadOnlyList<string> All = [Purple, Green, Orange, Red];

    /// <summary>The stored key for <paramref name="value"/>: null for none, refused when it is not one of <see cref="All"/>.</summary>
    public static string? Normalize(string? value)
    {
        var key = value?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(key)) return null;

        if (!All.Contains(key, StringComparer.Ordinal))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Appointments.InvalidStar)
                .WithData("Star", value!);
        }

        return key;
    }
}
