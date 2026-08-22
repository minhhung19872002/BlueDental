using System;
using BlueDental.Visits;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Visits;

public class VisitTests
{
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly DateTimeOffset _scheduled = DateTimeOffset.UtcNow.AddHours(1);

    [Fact]
    public void Should_Create_Visit_With_Scheduled_Status()
    {
        var visit = new Visit(Guid.NewGuid(), _patientId, _branchId, _scheduled, null, "Đau răng");

        Assert.Equal(VisitStatus.Scheduled, visit.Status);
        Assert.Equal(_patientId, visit.PatientId);
        Assert.Equal("Đau răng", visit.ChiefComplaint);
    }

    [Fact]
    public void Should_Transition_CheckIn_From_Scheduled()
    {
        var visit = new Visit(Guid.NewGuid(), _patientId, _branchId, _scheduled);
        visit.CheckIn();

        Assert.Equal(VisitStatus.CheckedIn, visit.Status);
        Assert.NotNull(visit.CheckedInAt);
    }

    [Fact]
    public void Should_Transition_Full_Lifecycle()
    {
        var visit = new Visit(Guid.NewGuid(), _patientId, _branchId, _scheduled);

        visit.CheckIn();
        Assert.Equal(VisitStatus.CheckedIn, visit.Status);

        visit.Start();
        Assert.Equal(VisitStatus.InProgress, visit.Status);

        visit.Complete("Đã hoàn thành điều trị");
        Assert.Equal(VisitStatus.Completed, visit.Status);
        Assert.NotNull(visit.CompletedAt);
        Assert.Equal("Đã hoàn thành điều trị", visit.Notes);
    }

    [Fact]
    public void Should_Throw_When_CheckIn_Not_Scheduled()
    {
        var visit = new Visit(Guid.NewGuid(), _patientId, _branchId, _scheduled);
        visit.CheckIn();

        Assert.Throws<BusinessException>(() => visit.CheckIn());
    }

    [Fact]
    public void Should_Cancel_With_Reason()
    {
        var visit = new Visit(Guid.NewGuid(), _patientId, _branchId, _scheduled);
        visit.Cancel("Bệnh nhân bận");

        Assert.Equal(VisitStatus.Cancelled, visit.Status);
        Assert.Equal("Bệnh nhân bận", visit.CancellationReason);
    }

    [Fact]
    public void Should_Throw_Cancel_Without_Reason()
    {
        var visit = new Visit(Guid.NewGuid(), _patientId, _branchId, _scheduled);
        Assert.Throws<ArgumentException>(() => visit.Cancel(""));
    }

    [Fact]
    public void Should_Mark_NoShow_From_Scheduled()
    {
        var visit = new Visit(Guid.NewGuid(), _patientId, _branchId, _scheduled);
        visit.MarkNoShow();

        Assert.Equal(VisitStatus.NoShow, visit.Status);
    }
}
