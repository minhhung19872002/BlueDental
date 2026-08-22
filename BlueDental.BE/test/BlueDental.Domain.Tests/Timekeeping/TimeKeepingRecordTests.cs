using System;
using BlueDental.Timekeeping;
using BlueDental.Timekeeping.Values;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Timekeeping;

public class TimeKeepingRecordTests
{
    private readonly Guid _staffId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly DateOnly _workDate = new(2026, 8, 24);

    private TimeKeepingRecord OpenDay() =>
        TimeKeepingRecord.OpenDay(Guid.NewGuid(), _staffId, _branchId, _workDate);

    private DateTimeOffset At(int hour, int minute = 0) =>
        new(new DateTime(_workDate.Year, _workDate.Month, _workDate.Day, hour, minute, 0), TimeSpan.FromHours(7));

    [Fact]
    public void Should_Open_Day_With_Default_Clinic_Shifts()
    {
        var record = OpenDay();

        Assert.Equal(WorkRegistration.NotRegistered, record.Registration);
        Assert.Equal(AttendanceStatus.NotStarted, record.Status);
        Assert.Equal(new TimeOnly(8, 0), record.MorningShift.PlannedStart);
        Assert.Equal(new TimeOnly(12, 0), record.MorningShift.PlannedEnd);
        Assert.Equal(new TimeOnly(13, 0), record.AfternoonShift.PlannedStart);
        Assert.Equal(new TimeOnly(17, 0), record.AfternoonShift.PlannedEnd);
    }

    [Fact]
    public void Should_Register_Working_And_Day_Off()
    {
        var record = OpenDay();

        record.RegisterWorking();
        Assert.Equal(WorkRegistration.Working, record.Registration);

        record.RegisterDayOff("Việc gia đình");
        Assert.Equal(WorkRegistration.DayOff, record.Registration);
        Assert.Equal(AttendanceStatus.OnLeave, record.Status);
        Assert.Equal("Việc gia đình", record.LeaveReason);
    }

    [Fact]
    public void Should_Not_Check_In_On_A_Registered_Day_Off()
    {
        var record = OpenDay();
        record.RegisterDayOff();

        Assert.Throws<BusinessException>(() =>
            record.CheckIn(WorkShiftKind.Morning, At(8)));
    }

    [Fact]
    public void Should_Track_Working_Status_Across_Both_Shifts()
    {
        var record = OpenDay();
        record.RegisterWorking();

        record.CheckIn(WorkShiftKind.Morning, At(8));
        Assert.Equal(AttendanceStatus.Working, record.Status);

        record.CheckOut(WorkShiftKind.Morning, At(12));
        Assert.Equal(AttendanceStatus.Completed, record.Status);
        Assert.Equal(240, record.MorningShift.WorkedMinutes);

        record.CheckIn(WorkShiftKind.Afternoon, At(13));
        Assert.Equal(AttendanceStatus.Working, record.Status);

        record.CheckOut(WorkShiftKind.Afternoon, At(17, 30));
        Assert.Equal(AttendanceStatus.Completed, record.Status);
        Assert.Equal(240 + 270, record.TotalWorkedMinutes);
    }

    [Fact]
    public void Should_Reject_Check_Out_Without_Check_In()
    {
        var record = OpenDay();

        Assert.Throws<BusinessException>(() =>
            record.CheckOut(WorkShiftKind.Morning, At(12)));
    }

    [Fact]
    public void Should_Reject_Double_Check_In()
    {
        var record = OpenDay();
        record.CheckIn(WorkShiftKind.Morning, At(8));

        Assert.Throws<BusinessException>(() =>
            record.CheckIn(WorkShiftKind.Morning, At(9)));
    }

    [Fact]
    public void Should_Lock_Registration_After_Attendance()
    {
        var record = OpenDay();
        record.CheckIn(WorkShiftKind.Morning, At(8));

        Assert.Throws<BusinessException>(() => record.RegisterDayOff());
        Assert.Throws<BusinessException>(() => record.RescheduleShifts(
            WorkShift.DefaultMorning(), WorkShift.DefaultAfternoon()));
    }

    [Fact]
    public void Should_Mark_Open_Shift_As_Abandoned()
    {
        var record = OpenDay();
        record.CheckIn(WorkShiftKind.Afternoon, At(13));

        Assert.True(record.HasOpenShift);
        record.MarkAbandoned("Không ra ca");

        Assert.Equal(AttendanceStatus.Abandoned, record.Status);
    }

    [Fact]
    public void Should_Not_Mark_Abandoned_When_All_Shifts_Are_Closed()
    {
        var record = OpenDay();
        record.CheckIn(WorkShiftKind.Morning, At(8));
        record.CheckOut(WorkShiftKind.Morning, At(12));

        Assert.Throws<BusinessException>(() => record.MarkAbandoned());
    }

    [Fact]
    public void Should_Accumulate_Overtime()
    {
        var record = OpenDay();

        record.AddOvertime(60).AddOvertime(30);

        Assert.Equal(90, record.OvertimeMinutes);
        Assert.Throws<BusinessException>(() => record.AddOvertime(-1));
    }

    [Fact]
    public void Should_Record_Who_Clocked_On_Behalf()
    {
        var record = OpenDay();
        var supervisorId = Guid.NewGuid();

        record.CheckIn(WorkShiftKind.Morning, At(8), supervisorId);

        Assert.Equal(supervisorId, record.RecordedByStaffId);
    }

    [Fact]
    public void Shift_Should_Reject_An_Inverted_Window()
    {
        Assert.Throws<BusinessException>(() =>
            new WorkShift(WorkShiftKind.Morning, new TimeOnly(12, 0), new TimeOnly(8, 0)));
    }

    [Fact]
    public void Shift_Should_Reject_Check_Out_Before_Check_In()
    {
        Assert.Throws<BusinessException>(() => new WorkShift(
            WorkShiftKind.Morning,
            new TimeOnly(8, 0),
            new TimeOnly(12, 0),
            At(10),
            At(9)));
    }
}
