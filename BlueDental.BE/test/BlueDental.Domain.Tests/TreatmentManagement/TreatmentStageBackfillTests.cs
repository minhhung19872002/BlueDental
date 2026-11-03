using System;
using System.Linq;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>
/// A "Tiếp tục công đoạn" dated before the row it continues (BA 2026-11-02):
/// written into the history, frozen, and the row it came from keeps its teeth
/// and stays the one being worked.
/// </summary>
public class TreatmentStageBackfillTests
{
    // Far enough back that "a day later" is never after today.
    private static readonly DateOnly Day = new(2026, 10, 20);
    private readonly Guid _staffId = Guid.NewGuid();

    private TreatmentStage Stage(DateOnly day, params int[] teeth) =>
        TreatmentStage.Add(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            1,
            "Niềng răng",
            _staffId,
            note: null,
            teeth: teeth.Select(code => new ToothSelection(code, selected: true)),
            treatmentDate: day);

    [Fact]
    public void A_back_dated_continue_is_frozen_and_takes_no_teeth()
    {
        var source = Stage(Day, 11, 12);

        var next = source.ContinueAs(
            Guid.NewGuid(), 2, _staffId, "lần 2", null, null, null,
            toothCodes: [11, 12], treatmentDate: Day.AddDays(-5));

        next.IsBackfill.ShouldBeTrue();
        next.IsSuperseded.ShouldBeTrue();
        next.Teeth.Select(t => t.ToothCode).ShouldBe([11, 12]);

        source.IsSuperseded.ShouldBeFalse();
        source.ContinuedToothCodes.ShouldBeEmpty();
        source.OpenTeeth.Count.ShouldBe(2);

        // The source is still the one being worked.
        source.Complete();
        source.Status.ShouldBe(TreatmentStageStatus.Completed);
    }

    [Fact]
    public void A_continue_on_the_same_day_or_later_hands_the_teeth_on()
    {
        var sameDay = Stage(Day, 11);
        var a = sameDay.ContinueAs(Guid.NewGuid(), 2, _staffId, null, null, null, null, treatmentDate: Day);
        a.IsBackfill.ShouldBeFalse();
        a.IsSuperseded.ShouldBeFalse();
        sameDay.IsSuperseded.ShouldBeTrue();

        var later = Stage(Day, 11);
        var b = later.ContinueAs(Guid.NewGuid(), 2, _staffId, null, null, null, null, treatmentDate: Day.AddDays(1));
        b.IsBackfill.ShouldBeFalse();
        later.IsSuperseded.ShouldBeTrue();
    }

    [Fact]
    public void Several_sources_count_their_newest_day()
    {
        var older = Stage(Day.AddDays(-10), 11);
        var newer = Stage(Day, 12);
        // Same line and kind as the first, so they may be continued together.
        var sibling = TreatmentStage.Add(
            Guid.NewGuid(), older.PatientId, older.ClinicBranchId, older.TreatmentId,
            older.TreatmentServiceId, older.ServiceId, 2, "Niềng răng", _staffId, note: null,
            teeth: [new ToothSelection(12, selected: true)], treatmentDate: newer.TreatmentDate);

        var next = older.ContinueAs(
            Guid.NewGuid(), 3, _staffId, null, null, null, null,
            alsoFrom: [(sibling, null)], treatmentDate: Day.AddDays(-3));

        next.IsBackfill.ShouldBeTrue();
        older.IsSuperseded.ShouldBeFalse();
        sibling.IsSuperseded.ShouldBeFalse();
        next.Teeth.Select(t => t.ToothCode).ShouldBe([11, 12]);
    }
}
