using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.PatientManagement;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.PatientManagement;

/// <summary>
/// What the sheets of a bộ hồ sơ bệnh án print about its slips — the clinic's
/// rules from save/P1810.drawio: the storage and outpatient numbers, and the
/// treatment's start and end dates.
/// </summary>
public class MedicalRecordTreatmentDatesTests
{
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();

    private TreatmentPlan APlan() =>
        TreatmentPlan.Open(Guid.NewGuid(), _patientId, Guid.NewGuid(), _branchId, "DT01", "Kế hoạch");

    private static TreatmentService ALine(TreatmentPlan plan) =>
        plan.AddService(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 500_000m, 1, DiscountType.None, 0m);

    private static TreatmentService ALineFor(TreatmentPlan plan, params int[] teeth) =>
        plan.AddService(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 500_000m, 1, DiscountType.None, 0m,
            teeth.Select(code => new ToothSelection(code, selected: true)));

    private TreatmentStage AStage(
        TreatmentService line, DateOnly day, bool done = true, bool warranty = false, params int[] teeth)
    {
        var stage = TreatmentStage.Add(
            Guid.NewGuid(), _patientId, _branchId, line.TreatmentPlanId, line.Id, line.ServiceId,
            1, "Công đoạn", Guid.NewGuid(), isGuarantee: warranty,
            teeth: teeth.Select(code => new ToothSelection(code, selected: true)), treatmentDate: day);
        return done ? stage.Complete() : stage;
    }

    // In the past: a công đoạn may not be dated after today.
    private static readonly DateOnly Oct18 = new(2025, 10, 18);
    private static readonly DateOnly Oct20 = new(2025, 10, 20);
    private static readonly DateOnly Nov02 = new(2025, 11, 2);

    [Fact]
    public void Storage_code_is_NK_month_year_patient_and_the_oldest_slip()
    {
        MedicalRecordSet.StorageCodeFor(Oct18, "DH264444", "DT01").ShouldBe("NK-1025DH264444DT01");
    }

    [Fact]
    public void Outpatient_number_is_NGT_month_year_patient_and_a_four_digit_day_count()
    {
        MedicalRecordSet.OutpatientNumberFor("DH264444", Oct18, 1).ShouldBe("NGT-1025DH264444-0001");
        MedicalRecordSet.OutpatientNumberFor("DH264444", Nov02, 27).ShouldBe("NGT-1125DH264444-0027");
    }

    [Fact]
    public void A_set_keeps_the_running_number_it_was_opened_with()
    {
        var set = MedicalRecordSet.Open(
            Guid.NewGuid(), _patientId, _branchId, "HSDH264444-18102026-01", MedicalRecordSet.AllForms, outpatientSequence: 1);

        set.OutpatientSequence.ShouldBe(1);
    }

    [Fact]
    public void Treatment_starts_on_the_oldest_cong_doan()
    {
        var plan = APlan();
        var line = ALine(plan);

        MedicalRecordTreatmentDates.StartOf([AStage(line, Oct20), AStage(line, Oct18)]).ShouldBe(Oct18);
        MedicalRecordTreatmentDates.StartOf([]).ShouldBeNull();
    }

    [Fact]
    public void A_slip_has_no_end_while_a_service_is_still_being_treated()
    {
        var plan = APlan();
        var done = ALine(plan).Start().Complete();
        var open = ALine(plan).Start();

        MedicalRecordTreatmentDates.EndOf(plan, [AStage(done, Oct18), AStage(open, Oct20, done: false)]).ShouldBeNull();
    }

    [Fact]
    public void A_slip_ends_on_the_day_its_last_service_was_finished()
    {
        var plan = APlan();
        var first = ALine(plan).Start().Complete();
        var second = ALine(plan).Start().Complete();

        MedicalRecordTreatmentDates.EndOf(plan, [AStage(first, Oct18), AStage(second, Oct20)]).ShouldBe(Oct20);
    }

    [Fact]
    public void A_cancelled_service_neither_holds_the_end_back_nor_sets_it()
    {
        var plan = APlan();
        var done = ALine(plan).Start().Complete();
        ALine(plan).Cancel();

        MedicalRecordTreatmentDates.EndOf(plan, [AStage(done, Oct18)]).ShouldBe(Oct18);
    }

    [Fact]
    public void Warranty_work_is_not_the_end_of_treatment()
    {
        var plan = APlan();
        var line = ALine(plan).Start().Complete();

        MedicalRecordTreatmentDates
            .EndOf(plan, [AStage(line, Oct18), AStage(line, Nov02, warranty: true)])
            .ShouldBe(Oct18);
    }

    [Fact]
    public void A_service_reopened_only_by_a_warranty_visit_stays_finished()
    {
        var plan = APlan();
        var line = ALine(plan).Start().Complete().Reopen();

        MedicalRecordTreatmentDates
            .EndOf(plan, [AStage(line, Oct18), AStage(line, Nov02, done: false, warranty: true)])
            .ShouldBe(Oct18);
    }

    [Fact]
    public void A_set_ends_only_once_every_slip_has_and_then_on_the_latest()
    {
        MedicalRecordTreatmentDates.EndOfAll(new List<DateOnly?> { Oct18, Oct20 }).ShouldBe(Oct20);
        MedicalRecordTreatmentDates.EndOfAll(new List<DateOnly?> { Oct18, null }).ShouldBeNull();
        MedicalRecordTreatmentDates.EndOfAll(new List<DateOnly?>()).ShouldBeNull();
    }

    [Fact]
    public void A_warranty_reopening_the_line_does_not_finish_a_tooth_never_worked()
    {
        var plan = APlan();
        var line = ALineFor(plan, 16, 17).Start();

        // 16 worked and closed, a warranty open on it; 17 never had a công đoạn.
        MedicalRecordTreatmentDates
            .EndOf(plan, [AStage(line, Oct18, teeth: 16), AStage(line, Nov02, done: false, warranty: true, teeth: 16)])
            .ShouldBeNull();
    }

    [Fact]
    public void The_set_ends_on_the_last_service_of_the_last_slip_even_with_a_later_warranty()
    {
        // Slip 1 finished on 18/10 and was under warranty on 02/11; slip 2 finished on 20/10.
        var first = APlan();
        var warrantied = ALine(first).Start().Complete();
        var second = APlan();
        var last = ALine(second).Start().Complete();
        var stages = new List<TreatmentStage>
        {
            AStage(warrantied, Oct18),
            AStage(warrantied, Nov02, warranty: true),
            AStage(last, Oct20),
        };

        var ends = new List<DateOnly?> { MedicalRecordTreatmentDates.EndOf(first, stages), MedicalRecordTreatmentDates.EndOf(second, stages) };

        ends.ShouldBe([Oct18, Oct20]);
        MedicalRecordTreatmentDates.EndOfAll(ends).ShouldBe(Oct20);
    }

    [Fact]
    public void A_cancelled_slip_or_one_with_every_service_cancelled_no_longer_counts()
    {
        var live = APlan();
        ALine(live);
        MedicalRecordTreatmentDates.Counts(live).ShouldBeTrue();

        var emptied = APlan();
        ALine(emptied).Cancel();
        MedicalRecordTreatmentDates.Counts(emptied).ShouldBeFalse();

        var cancelled = APlan();
        ALine(cancelled);
        cancelled.Cancel();
        MedicalRecordTreatmentDates.Counts(cancelled).ShouldBeFalse();
    }
}
