using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.PatientManagement;

namespace BlueDental.CustomerCare;

/// <summary>
/// Who the Chúc mừng sinh nhật tab is about (owner, 2026-10-05): patients whose
/// date of birth falls, by month and day, inside the window. Shared by the task
/// sync and the list query, so a task that is not a real birthday — no date of
/// birth, or born outside the window — never shows.
/// </summary>
public static class CareBirthdayRules
{
    /// <summary>The window cut at month ends: each piece lies within one month.</summary>
    public static IEnumerable<(DateOnly From, DateOnly To)> MonthPieces(DateOnly from, DateOnly to)
    {
        for (var start = from; start <= to;)
        {
            var monthEnd = new DateOnly(start.Year, start.Month, DateTime.DaysInMonth(start.Year, start.Month));
            var end = monthEnd < to ? monthEnd : to;
            yield return (start, end);
            start = end.AddDays(1);
        }
    }

    /// <summary>Patients born on [from, to] of one month, by month and day.</summary>
    public static IQueryable<Patient> BornIn(IQueryable<Patient> patients, DateOnly from, DateOnly to)
    {
        var month = from.Month;
        var firstDay = from.Day;
        var lastDay = to.Day;

        // A 29 February birthday is greeted on the 28th in a common year.
        if (month == 2 && !DateTime.IsLeapYear(from.Year) && lastDay == 28)
        {
            lastDay = 29;
        }

        return patients.Where(p => p.DateOfBirth.HasValue
            && p.DateOfBirth.Value.Month == month
            && p.DateOfBirth.Value.Day >= firstDay
            && p.DateOfBirth.Value.Day <= lastDay);
    }

    /// <summary>Ids of the patients whose birthday falls anywhere in [from, to].</summary>
    public static IQueryable<Guid> PatientIdsBornIn(IQueryable<Patient> patients, DateOnly from, DateOnly to)
    {
        IQueryable<Guid>? ids = null;
        foreach (var (start, end) in MonthPieces(from, to))
        {
            var piece = BornIn(patients, start, end).Select(p => p.Id);
            ids = ids is null ? piece : ids.Union(piece);
        }

        return ids ?? patients.Where(_ => false).Select(p => p.Id);
    }
}
