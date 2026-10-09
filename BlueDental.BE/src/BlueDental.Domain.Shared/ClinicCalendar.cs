using System;

namespace BlueDental;

/// <summary>
/// The clinic's own calendar day. Instants are stored in UTC, but "the same
/// treatment day" is a Vietnam day: a visit at 06:30 local is 23:30 UTC the
/// day before.
/// </summary>
public static class ClinicCalendar
{
    /// <summary>Windows id first, IANA second — whichever the host OS knows.</summary>
    private static readonly string[] TimeZoneIds = ["SE Asia Standard Time", "Asia/Ho_Chi_Minh"];

    private static readonly TimeSpan FallbackOffset = TimeSpan.FromHours(7);

    private static readonly TimeZoneInfo? Zone = FindZone();

    /// <summary>The clinic-local calendar date an instant falls on.</summary>
    public static DateOnly DateOf(DateTimeOffset instant)
        => DateOnly.FromDateTime(ToLocal(instant).DateTime);

    /// <summary>The same instant on the clinic's wall clock.</summary>
    public static DateTimeOffset ToLocal(DateTimeOffset instant)
        => Zone is null
            ? instant.ToOffset(FallbackOffset)
            : TimeZoneInfo.ConvertTime(instant, Zone);

    /// <summary>The instant a clinic-local day starts, in UTC.</summary>
    public static DateTimeOffset StartOfDay(DateOnly day)
    {
        var local = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        var offset = Zone?.GetUtcOffset(local) ?? FallbackOffset;
        return new DateTimeOffset(local, offset).ToUniversalTime();
    }

    /// <summary>The instant a clinic-local day and time fall on, in UTC.</summary>
    public static DateTimeOffset AtLocal(DateOnly day, TimeOnly time)
    {
        var local = day.ToDateTime(time, DateTimeKind.Unspecified);
        var offset = Zone?.GetUtcOffset(local) ?? FallbackOffset;
        return new DateTimeOffset(local, offset).ToUniversalTime();
    }

    private static TimeZoneInfo? FindZone()
    {
        foreach (var id in TimeZoneIds)
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
                // Try the next spelling; the fixed +07:00 offset is the last resort.
            }
        }

        return null;
    }
}
