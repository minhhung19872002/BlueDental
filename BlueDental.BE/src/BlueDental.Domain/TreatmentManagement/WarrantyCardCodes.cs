using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Volo.Abp.Domain.Entities;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// The warranty card number both card kinds share (P3110, BA 2026-11-01 over
/// G5): <c>BH-{line code}-{ddMMyyyy start}-{xx}</c>, xx running from 01 per
/// service line and start date — Dịch vụ and Labo cards of one line and day
/// draw from the same count.
/// </summary>
public static class WarrantyCardCode
{
    /// <summary><c>BH-DT01-02-01112026-01</c>.</summary>
    public static string Format(string lineCode, DateOnly startDate, int number)
        => $"BH-{lineCode}-{startDate:ddMMyyyy}-{number:D2}";

    /// <summary>
    /// The codes for a batch of cards on one line, aligned with
    /// <paramref name="startDates"/>. Each start date reserves its numbers in
    /// one step, so the cards of one activation run consecutively; days are
    /// taken in date order so two batches never wait on each other crosswise.
    /// </summary>
    public static async Task<IReadOnlyList<string>> IssueAsync(
        this IWarrantyCardNumberer numberer, Guid lineId, string lineCode, IReadOnlyList<DateOnly> startDates)
    {
        var codes = new string[startDates.Count];
        var days = startDates
            .Select((startDate, index) => (startDate, index))
            .GroupBy(card => card.startDate)
            .OrderBy(day => day.Key);
        foreach (var day in days)
        {
            var cards = day.ToList();
            var first = await numberer.ReserveAsync(lineId, day.Key, cards.Count);
            for (var i = 0; i < cards.Count; i++)
            {
                codes[cards[i].index] = Format(lineCode, day.Key, first + i);
            }
        }

        return codes;
    }
}

/// <summary>Hands out card numbers inside the caller's transaction.</summary>
public interface IWarrantyCardNumberer
{
    /// <summary>
    /// Reserves <paramref name="count"/> consecutive numbers for the line and
    /// start date and returns the first. A concurrent caller on the same pair
    /// waits for this transaction; a rollback gives the numbers back.
    /// </summary>
    Task<int> ReserveAsync(Guid treatmentServiceId, DateOnly startDate, int count);
}

/// <summary>The last card number issued for one service line and start date.</summary>
public class WarrantyCardSequence : Entity
{
    public Guid TreatmentServiceId { get; private set; }
    public DateOnly StartDate { get; private set; }
    public int LastNo { get; private set; }

    protected WarrantyCardSequence() { }

    public override object[] GetKeys() => [TreatmentServiceId, StartDate];
}
