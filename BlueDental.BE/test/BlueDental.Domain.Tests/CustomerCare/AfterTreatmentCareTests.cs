using System;
using BlueDental.CustomerCare;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.CustomerCare;

public class AfterTreatmentCareTests
{
    private static readonly DateOnly TreatedOn = new(2026, 10, 4);

    private static CareRecord Open(Guid? stageId = null) =>
        CareRecord.AfterTreatment(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            TreatedOn,
            stageId ?? Guid.NewGuid());

    [Fact]
    public void A_visit_opens_an_uncontacted_task_with_no_care_date()
    {
        var stageId = Guid.NewGuid();
        var record = Open(stageId);

        record.Type.ShouldBe(CareType.AfterTreatment);
        record.Status.ShouldBe(CareStatus.New);
        record.DueAt.ShouldBeNull();
        record.TreatmentDate.ShouldBe(TreatedOn);
        record.StageIds.ShouldBe([stageId]);
    }

    [Fact]
    public void Another_stage_the_same_day_joins_the_task_once()
    {
        var record = Open();
        var second = Guid.NewGuid();

        record.FollowUpStage(second);
        record.FollowUpStage(second);

        record.StageIds.Count.ShouldBe(2);
        record.StageIds.ShouldContain(second);
    }

    [Fact]
    public void Contacting_sets_the_care_date_and_undoing_clears_it()
    {
        var record = Open();
        var at = new DateTimeOffset(2026, 10, 5, 3, 0, 0, TimeSpan.Zero);

        record.SetContacted(true, at).ShouldBeTrue();
        record.Status.ShouldBe(CareStatus.Contacted);
        record.DueAt.ShouldBe(at);

        record.SetContacted(false, at.AddHours(1)).ShouldBeTrue();
        record.Status.ShouldBe(CareStatus.New);
        record.DueAt.ShouldBeNull();
    }

    [Fact]
    public void Picking_the_current_state_again_is_not_a_change()
    {
        var record = Open();

        record.SetContacted(false, DateTimeOffset.UtcNow).ShouldBeFalse();
        record.SetContacted(true, DateTimeOffset.UtcNow).ShouldBeTrue();
        record.SetContacted(true, DateTimeOffset.UtcNow).ShouldBeFalse();
    }

    [Fact]
    public void Contact_state_does_not_move_the_due_date_of_other_care_types()
    {
        var due = new DateTimeOffset(2026, 10, 10, 2, 0, 0, TimeSpan.Zero);
        var record = new CareRecord(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), CareType.Birthday, "Sinh nhật", dueAt: due);

        record.SetContacted(true, DateTimeOffset.UtcNow);
        record.SetContacted(false, DateTimeOffset.UtcNow);

        record.DueAt.ShouldBe(due);
    }

    [Fact]
    public void A_finished_task_refuses_the_contact_toggle()
    {
        var record = Open();
        record.Succeed(CareOutcome.Good);

        Should.Throw<BusinessException>(() => record.SetContacted(false, DateTimeOffset.UtcNow))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.CustomerCare.InvalidTransition);
    }

    [Fact]
    public void The_contact_log_captures_the_state_after_the_change()
    {
        var record = Open();
        record.SetContacted(true, DateTimeOffset.UtcNow);

        var log = CareContactLog.Of(Guid.NewGuid(), record, "  Khách ổn  ");

        log.CareRecordId.ShouldBe(record.Id);
        log.BranchId.ShouldBe(record.BranchId);
        log.Status.ShouldBe(CareStatus.Contacted);
        log.Note.ShouldBe("Khách ổn");
    }

    [Theory]
    [InlineData("2026-10-04T16:59:59Z", "2026-10-04")]
    [InlineData("2026-10-04T17:00:00Z", "2026-10-05")]
    [InlineData("2026-10-05T06:30:00+07:00", "2026-10-05")]
    public void The_treatment_day_is_the_clinic_day(string instant, string expected)
    {
        ClinicCalendar.DateOf(DateTimeOffset.Parse(instant)).ShouldBe(DateOnly.Parse(expected));
    }
}
