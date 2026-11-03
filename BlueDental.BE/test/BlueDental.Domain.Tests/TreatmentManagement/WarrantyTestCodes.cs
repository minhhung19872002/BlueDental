using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.TreatmentManagement;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>Card numbers for tests that do not read them.</summary>
internal static class WarrantyTestCodes
{
    public static IReadOnlyList<string> For(int count) =>
        Enumerable.Range(1, count).Select(i => $"BH-TEST-{i:D2}").ToList();
}

/// <summary>The shared line + start-day count, kept in memory.</summary>
internal sealed class InMemoryWarrantyCardNumberer : IWarrantyCardNumberer
{
    private readonly Dictionary<(Guid, DateOnly), int> _last = new();

    public Task<int> ReserveAsync(Guid treatmentServiceId, DateOnly startDate, int count)
    {
        var last = _last.GetValueOrDefault((treatmentServiceId, startDate)) + count;
        _last[(treatmentServiceId, startDate)] = last;
        return Task.FromResult(last - count + 1);
    }
}
