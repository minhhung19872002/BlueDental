using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Staff;

namespace BlueDental.TreatmentManagement;

/// <summary>How a <see cref="SlipScope"/> reads one slip (BA bug 40, 2026-10-21).</summary>
public static class SlipScopeReading
{
    /// <summary>The slip was received inside the scope or one of its lines is assigned inside it.</summary>
    public static bool Covers(this SlipScope scope, TreatmentPlan plan) =>
        scope.Covers(plan.DentistId, plan.Services.SelectMany(plan.AssigneesOf));

    /// <returns>
    /// <c>null</c> when the viewer sees the whole slip (no scope, or received
    /// inside it); otherwise the lines assigned inside the scope — the only
    /// ones the viewer may act on.
    /// </returns>
    public static IReadOnlySet<Guid>? OwnLinesOf(this SlipScope? scope, TreatmentPlan plan) =>
        scope is null || scope.SeesWhole(plan.DentistId)
            ? null
            : plan.Services
                .Where(line => plan.AssigneesOf(line).Any(scope.Includes))
                .Select(line => line.Id)
                .ToHashSet();

    /// <returns>
    /// <c>null</c> when the whole slip's money shows; otherwise the lines whose
    /// money does — <see cref="OwnLinesOf"/>, or none without "Chi phí › Xem"
    /// ("Dc assign mà ko có quyền xem thì masking lại hết").
    /// </returns>
    public static IReadOnlySet<Guid>? MoneyLinesOf(this SlipScope? scope, TreatmentPlan plan) =>
        scope.OwnLinesOf(plan) switch
        {
            null => null,
            var ownLines when scope!.ShowsLineMoney => ownLines,
            _ => new HashSet<Guid>(),
        };
}
