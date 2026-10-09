using System;
using BlueDental.CustomerCare;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.CustomerCare;

public class UndatedRebookCareTests
{
    private static readonly DateTimeOffset SavedAt = new(2026, 10, 9, 3, 0, 0, TimeSpan.Zero);

    private static CareRecord Open(string? note, Guid? dentistId = null) =>
        CareRecord.UndatedRebook(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            dentistId,
            Guid.NewGuid(),
            SavedAt,
            note);

    [Fact]
    public void Opens_an_uncontacted_task_due_when_saved_with_the_note_as_content()
    {
        var dentistId = Guid.NewGuid();
        var record = Open("  Tai kham sau nho rang  ", dentistId);

        record.Type.ShouldBe(CareType.UndatedRebook);
        record.Status.ShouldBe(CareStatus.New);
        record.DueAt.ShouldBe(SavedAt);
        record.AssignedStaffId.ShouldBe(dentistId);
        record.AppointmentId.ShouldNotBeNull();
        record.Subject.ShouldBe("Tai kham sau nho rang");
        record.Description.ShouldBeNull();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public void Without_a_note_the_content_names_the_tab(string? note)
    {
        Open(note).Subject.ShouldBe(CareRecord.UndatedRebookSubject);
    }

    [Fact]
    public void Saving_again_moves_doctor_and_note_but_keeps_the_care_done()
    {
        var record = Open("first");
        record.SetContacted(true, SavedAt.AddHours(1));
        record.UpdateNote("called, will ring back");
        var otherDentist = Guid.NewGuid();

        record.RefreshUndatedRebook(otherDentist, "second");

        record.AssignedStaffId.ShouldBe(otherDentist);
        record.Subject.ShouldBe("second");
        record.IsContacted.ShouldBeTrue();
        record.Description.ShouldBe("called, will ring back");
    }

    [Fact]
    public void A_cancelled_task_is_not_refreshed()
    {
        var record = Open("first");
        record.Cancel("duplicate");

        Should.Throw<BusinessException>(() => record.RefreshUndatedRebook(null, "second"));
    }
}
