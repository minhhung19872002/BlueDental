using System;
using BlueDental.Timekeeping;
using BlueDental.Timekeeping.Values;
using Volo.Abp.Identity;
using Xunit;

namespace BlueDental.Appointments;

public class DentistShiftCheckerTests
{
    private static readonly TimeSpan Vn = TimeSpan.FromHours(7);
    private static readonly DateOnly Day = new(2026, 10, 21);

    private static DateTimeOffset At(int hour, int minute = 0)
        => new(Day.ToDateTime(new TimeOnly(hour, minute)), Vn);

    private static TimeKeepingRecord Record()
        => TimeKeepingRecord.OpenDay(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Day);

    [Fact]
    public void Without_A_Record_The_Default_Shifts_Apply()
    {
        var windows = DentistShiftChecker.WorkingWindows(null);

        Assert.Equal("08:00-12:00, 13:00-17:00", DentistShiftChecker.Describe(windows));
    }

    [Fact]
    public void Without_A_Record_The_Profile_Hours_Apply()
    {
        // Bug: profile afternoon ran to 19:00 (as the Chấm công board showed),
        // yet a 17:15 booking was refused against the 17:00 clinic default.
        var dentist = new IdentityUser(Guid.NewGuid(), "bs.toi", "bs.toi@example.test");
        dentist.ExtraProperties["AfternoonStartTime"] = "13:00";
        dentist.ExtraProperties["AfternoonEndTime"] = "19:00";

        var windows = DentistShiftChecker.WorkingWindows(null, dentist);

        Assert.Equal("08:00-12:00, 13:00-19:00", DentistShiftChecker.Describe(windows));
    }

    [Fact]
    public void A_Record_Wins_Over_The_Profile_Hours()
    {
        var dentist = new IdentityUser(Guid.NewGuid(), "bs.toi", "bs.toi@example.test");
        dentist.ExtraProperties["AfternoonStartTime"] = "13:00";
        dentist.ExtraProperties["AfternoonEndTime"] = "19:00";

        var windows = DentistShiftChecker.WorkingWindows(Record(), dentist);

        Assert.Equal("08:00-12:00, 13:00-17:00", DentistShiftChecker.Describe(windows));
    }

    [Fact]
    public void A_Day_Off_Has_No_Working_Hours()
    {
        var record = Record().RegisterDayOff("Nghỉ phép");

        Assert.Empty(DentistShiftChecker.WorkingWindows(record));
    }

    [Fact]
    public void A_Half_Day_Leave_From_Before_The_Board_Takes_Its_Half()
    {
        var record = Record().RegisterLeave(
            new LeaveWindow(LeaveShift.Morning, new TimeOnly(9, 0), new TimeOnly(10, 0)));

        Assert.Equal("13:00-17:00", DentistShiftChecker.Describe(DentistShiftChecker.WorkingWindows(record)));
    }

    [Fact]
    public void Rescheduled_Shifts_Replace_The_Defaults_And_Touching_Ones_Join()
    {
        var record = Record().RescheduleShifts(
            new WorkShift(WorkShiftKind.Morning, new TimeOnly(9, 0), new TimeOnly(13, 0)),
            new WorkShift(WorkShiftKind.Afternoon, new TimeOnly(13, 0), new TimeOnly(20, 0)));

        var windows = DentistShiftChecker.WorkingWindows(record);

        Assert.Equal("09:00-20:00", DentistShiftChecker.Describe(windows));
    }

    [Fact]
    public void Leave_And_A_Day_Off_Leave_The_Planned_Shifts_As_They_Were()
    {
        // The follow-up picker draws its timeline over the planned shifts and
        // greys out what leave or a day off takes away.
        var leave = Record().RegisterLeave(
            new LeaveWindow(LeaveShift.Morning, new TimeOnly(9, 0), new TimeOnly(10, 0)));
        var dayOff = Record().RegisterDayOff("Nghỉ phép");

        foreach (var record in new[] { leave, dayOff })
        {
            var (morning, afternoon) = DentistShiftChecker.PlannedShifts(record);
            Assert.Equal(new ShiftWindow(new TimeOnly(8, 0), new TimeOnly(12, 0)), morning);
            Assert.Equal(new ShiftWindow(new TimeOnly(13, 0), new TimeOnly(17, 0)), afternoon);
        }
    }

    [Fact]
    public void Without_A_Record_The_Planned_Shifts_Are_The_Profile_Hours()
    {
        var dentist = new IdentityUser(Guid.NewGuid(), "bs.toi", "bs.toi@example.test");
        dentist.ExtraProperties["MorningStartTime"] = "07:30";
        dentist.ExtraProperties["MorningEndTime"] = "11:30";

        var (morning, afternoon) = DentistShiftChecker.PlannedShifts(null, dentist);

        Assert.Equal(new ShiftWindow(new TimeOnly(7, 30), new TimeOnly(11, 30)), morning);
        Assert.Equal(new ShiftWindow(new TimeOnly(13, 0), new TimeOnly(17, 0)), afternoon);
    }

    [Theory]
    [InlineData(WorkScheduleShift.Morning, "13:00-17:00")]
    [InlineData(WorkScheduleShift.Afternoon, "08:00-12:00")]
    [InlineData(WorkScheduleShift.FullDay, "")]
    public void A_Half_Day_Off_Leaves_The_Other_Half(WorkScheduleShift shift, string expected)
    {
        // Lịch nghỉ (R-1210): S = nghỉ sáng, C = nghỉ chiều, SC = nghỉ cả ngày.
        var record = Record().ScheduleShift(shift);

        Assert.Equal(expected, DentistShiftChecker.Describe(DentistShiftChecker.WorkingWindows(record)));
    }

    [Theory]
    // Nothing off: any hour, evenings and lunch included (owner, 2026-11-11).
    [InlineData(WorkScheduleShift.None, 6, 0, 6, 30, WorkScheduleShift.None)]
    [InlineData(WorkScheduleShift.None, 12, 15, 12, 45, WorkScheduleShift.None)]
    [InlineData(WorkScheduleShift.None, 20, 0, 20, 30, WorkScheduleShift.None)]
    // Nghỉ sáng: refused while the slot starts before the 13:00 afternoon.
    [InlineData(WorkScheduleShift.Morning, 8, 0, 8, 30, WorkScheduleShift.Morning)]
    [InlineData(WorkScheduleShift.Morning, 12, 30, 13, 0, WorkScheduleShift.Morning)]
    [InlineData(WorkScheduleShift.Morning, 12, 45, 13, 15, WorkScheduleShift.Morning)]
    [InlineData(WorkScheduleShift.Morning, 13, 0, 13, 30, WorkScheduleShift.None)]
    [InlineData(WorkScheduleShift.Morning, 19, 0, 19, 30, WorkScheduleShift.None)]
    // Nghỉ chiều: refused once the slot ends after the 12:00 morning end.
    [InlineData(WorkScheduleShift.Afternoon, 7, 0, 7, 30, WorkScheduleShift.None)]
    [InlineData(WorkScheduleShift.Afternoon, 11, 30, 12, 0, WorkScheduleShift.None)]
    [InlineData(WorkScheduleShift.Afternoon, 11, 45, 12, 15, WorkScheduleShift.Afternoon)]
    [InlineData(WorkScheduleShift.Afternoon, 14, 0, 14, 30, WorkScheduleShift.Afternoon)]
    [InlineData(WorkScheduleShift.Afternoon, 19, 0, 19, 30, WorkScheduleShift.Afternoon)]
    // Nghỉ cả ngày: every hour.
    [InlineData(WorkScheduleShift.FullDay, 6, 0, 6, 30, WorkScheduleShift.FullDay)]
    [InlineData(WorkScheduleShift.FullDay, 20, 0, 20, 30, WorkScheduleShift.FullDay)]
    public void A_Day_Off_Splits_At_Midday(
        WorkScheduleShift off, int sh, int sm, int eh, int em, WorkScheduleShift expected)
    {
        var record = Record().ScheduleShift(off);

        Assert.Equal(expected, DentistShiftChecker.OffConflict(record, At(sh, sm), At(eh, em)));
    }

    [Fact]
    public void Without_A_Record_Nothing_Is_Off()
    {
        Assert.Equal(WorkScheduleShift.None, DentistShiftChecker.OffConflict(null, At(5, 0), At(23, 0)));
    }

    [Fact]
    public void Nghi_Chieu_Refuses_A_Slot_Running_Past_Midnight()
    {
        var record = Record().ScheduleShift(WorkScheduleShift.Afternoon);

        Assert.Equal(
            WorkScheduleShift.Afternoon,
            DentistShiftChecker.OffConflict(record, At(8, 0), At(8, 0).AddDays(1)));
    }

    [Fact]
    public void The_Split_Follows_The_Day_s_Rescheduled_Shifts()
    {
        var record = Record()
            .RescheduleShifts(
                new WorkShift(WorkShiftKind.Morning, new TimeOnly(7, 30), new TimeOnly(11, 30)),
                new WorkShift(WorkShiftKind.Afternoon, new TimeOnly(14, 0), new TimeOnly(20, 0)))
            .ScheduleShift(WorkScheduleShift.Morning);

        Assert.Equal(WorkScheduleShift.Morning, DentistShiftChecker.OffConflict(record, At(13, 30), At(14, 0)));
        Assert.Equal(WorkScheduleShift.None, DentistShiftChecker.OffConflict(record, At(14, 0), At(14, 30)));
    }

    [Theory]
    [InlineData(WorkScheduleShift.Morning, 9, 10, true)]
    [InlineData(WorkScheduleShift.Morning, 14, 15, false)]
    [InlineData(WorkScheduleShift.Afternoon, 14, 15, true)]
    [InlineData(WorkScheduleShift.Afternoon, 9, 10, false)]
    [InlineData(WorkScheduleShift.FullDay, 19, 20, true)]
    [InlineData(WorkScheduleShift.None, 9, 10, false)]
    public void A_Day_Off_Not_Yet_Saved_Splits_The_Day_The_Same_Way(
        WorkScheduleShift off, int startHour, int endHour, bool clashes)
    {
        // The Lịch nghỉ board asks this of appointments already booked before
        // letting a new S / C / SC stand (BA 2026-11-14).
        var (morning, afternoon) = DentistShiftChecker.PlannedShifts(null);

        var conflict = DentistShiftChecker.OffConflict(off, morning, afternoon, At(startHour), At(endHour));

        Assert.Equal(clashes ? off : WorkScheduleShift.None, conflict);
    }
}
