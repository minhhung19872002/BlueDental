using System;
using System.Linq;
using BlueDental.PatientManagement;
using BlueDental.TreatmentManagement;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.PatientManagement;

/// <summary>
/// Bộ hồ sơ bệnh án and the slips it holds — the clinic's rules from
/// save/P1710.drawio: numbering, which slips may join, leave or move, and what
/// cancelling a set or a sheet leaves behind.
/// </summary>
public class MedicalRecordSetTests
{
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();

    private MedicalRecordSet ASet(string code = "HSBD260001-17102026-01") =>
        MedicalRecordSet.Open(Guid.NewGuid(), _patientId, _branchId, code, MedicalRecordSet.AllForms);

    private TreatmentPlan APlan(string code = "DT01", Guid? patientId = null) =>
        TreatmentPlan.Open(Guid.NewGuid(), patientId ?? _patientId, Guid.NewGuid(), _branchId, code, "Kế hoạch");

    private static TreatmentService ALine(TreatmentPlan plan) =>
        plan.AddService(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 500_000m, 1, DiscountType.None, 0m);

    private static PatientMedicalRecord ASheet(Guid setId) =>
        PatientMedicalRecord.Add(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), setId, MedicalRecordForm.Cover, "Bìa", 0);

    [Fact]
    public void The_code_is_HS_patient_code_day_and_a_two_digit_count()
    {
        MedicalRecordSet.CodeFor("DH260253", new DateOnly(2026, 10, 17), 1).ShouldBe("HSDH260253-17102026-01");
        MedicalRecordSet.CodeFor("DH260253", new DateOnly(2026, 10, 17), 12).ShouldBe("HSDH260253-17102026-12");
    }

    [Fact]
    public void Unticked_forms_leave_the_index_and_at_least_one_must_stay()
    {
        var set = ASet().ShowOnly([MedicalRecordForm.Cover, MedicalRecordForm.TreatmentFollowUp]);

        set.VisibleForms.ShouldBe([MedicalRecordForm.Cover, MedicalRecordForm.TreatmentFollowUp]);
        Should.Throw<BusinessException>(() => set.ShowOnly([]))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSetNeedsForm);
    }

    [Fact]
    public void A_fresh_slip_or_one_whose_lines_have_not_started_is_not_started()
    {
        var plan = APlan();
        MedicalRecordSetPlanRules.IsNotStarted(plan).ShouldBeTrue();

        var line = ALine(plan);
        MedicalRecordSetPlanRules.IsNotStarted(plan).ShouldBeTrue();

        line.Start();
        MedicalRecordSetPlanRules.IsNotStarted(plan).ShouldBeFalse();
    }

    [Fact]
    public void A_slip_not_yet_started_leaves_its_set_and_a_free_slip_joins_any()
    {
        var plan = APlan();

        Should.NotThrow(() => MedicalRecordSetPlanRules.EnsureCanJoin(plan, ASet(), holder: null));
        Should.NotThrow(() => MedicalRecordSetPlanRules.EnsureCanLeave(plan));
    }

    [Fact]
    public void No_set_new_or_edited_takes_a_slip_another_set_holds()
    {
        // Not yet started, and still refused: it leaves its own set first.
        var plan = APlan();
        var first = ASet().Attach(plan.Id, plan.DentistId, DateTime.UtcNow);
        var second = ASet("HSBD260001-17102026-02");

        Should.Throw<BusinessException>(() => MedicalRecordSetPlanRules.EnsureCanJoin(plan, second, first))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSetPlanTaken);
        // Its own set holding it is no obstacle.
        Should.NotThrow(() => MedicalRecordSetPlanRules.EnsureCanJoin(plan, first, first));
    }

    [Fact]
    public void A_started_slip_already_in_a_set_cannot_leave_it()
    {
        var plan = APlan();
        ALine(plan).Start();

        Should.Throw<BusinessException>(() => MedicalRecordSetPlanRules.EnsureCanLeave(plan))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSetPlanLocked);
    }

    [Fact]
    public void A_started_slip_in_no_set_may_still_join_one()
    {
        var plan = APlan();
        ALine(plan).Start();

        Should.NotThrow(() => MedicalRecordSetPlanRules.EnsureCanJoin(plan, ASet(), holder: null));
    }

    [Fact]
    public void A_cancelled_slip_or_another_patients_slip_joins_nothing()
    {
        var cancelled = APlan().Cancel();
        Should.Throw<BusinessException>(() => MedicalRecordSetPlanRules.EnsureCanJoin(cancelled, ASet(), null))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSetPlanUnavailable);

        var someoneElses = APlan(patientId: Guid.NewGuid());
        Should.Throw<BusinessException>(() => MedicalRecordSetPlanRules.EnsureCanJoin(someoneElses, ASet(), null))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSetPlanUnavailable);
    }

    [Fact]
    public void Each_slip_keeps_its_own_doctor()
    {
        var first = APlan("DT01");
        var second = APlan("DT02");
        var set = ASet()
            .Attach(first.Id, first.DentistId, DateTime.UtcNow)
            .Attach(second.Id, second.DentistId, DateTime.UtcNow);

        set.HeldPlans.Select(link => link.DentistId).ShouldBe([first.DentistId, second.DentistId], ignoreOrder: true);
    }

    [Fact]
    public void Cancelling_a_set_frees_its_slips_keeps_them_as_history_and_freezes_it()
    {
        var plan = APlan();
        var by = Guid.NewGuid();
        var set = ASet().Attach(plan.Id, plan.DentistId, DateTime.UtcNow);

        set.Cancel(new DateTime(2026, 10, 17, 3, 0, 0, DateTimeKind.Utc), by);

        set.IsCancelled.ShouldBeTrue();
        set.CancelledById.ShouldBe(by);
        set.Holds(plan.Id).ShouldBeFalse();
        set.Plans.Single().Released.ShouldBeTrue();
        Should.Throw<BusinessException>(() => set.Attach(Guid.NewGuid(), Guid.NewGuid(), DateTime.UtcNow))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSetCancelled);
        Should.Throw<BusinessException>(() => set.Cancel(DateTime.UtcNow, by))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSetCancelled);
    }

    [Fact]
    public void Cancelling_a_sheet_needs_a_reason_logs_who_and_when_and_locks_it()
    {
        var sheet = ASheet(Guid.NewGuid());
        Should.Throw<BusinessException>(() => sheet.Cancel("  ", DateTime.UtcNow, Guid.NewGuid()))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordCancelReasonRequired);

        var by = Guid.NewGuid();
        var at = new DateTime(2026, 10, 17, 2, 12, 0, DateTimeKind.Utc);
        sheet.Cancel(" Ghi sai ngày tái khám ", at, by);

        sheet.IsCancelled.ShouldBeTrue();
        sheet.CancelReason.ShouldBe("Ghi sai ngày tái khám");
        sheet.CancelledAt.ShouldBe(at);
        sheet.CancelledById.ShouldBe(by);
        Should.Throw<BusinessException>(() => sheet.Fill("{}"))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSheetCancelled);
        Should.Throw<BusinessException>(() => sheet.Rename("Bìa 2"))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSheetCancelled);
    }
}
