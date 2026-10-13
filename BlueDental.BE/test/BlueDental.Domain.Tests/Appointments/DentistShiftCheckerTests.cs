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
        Assert.True(DentistShiftChecker.Fits(windows, At(17, 15), At(17, 45)));
    }

    [Fact]
    public void A_Slot_Ending_On_The_Shift_End_Fits_Despite_Stray_Milliseconds()
    {
        // Bug 2026-10-13 (Tạo tiếp nhận): the day came from dayjs() with its
        // milliseconds, so 18:30-19:00 arrived as 18:30:00.437-19:00:00.437.
        var record = Record().RescheduleShifts(
            WorkShift.DefaultMorning(),
            new WorkShift(WorkShiftKind.Afternoon, new TimeOnly(13, 0), new TimeOnly(19, 0)));
        var windows = DentistShiftChecker.WorkingWindows(record);

        Assert.True(DentistShiftChecker.Fits(
            windows, At(18, 30).AddMilliseconds(437), At(19, 0).AddMilliseconds(437)));
        Assert.False(DentistShiftChecker.Fits(windows, At(18, 45), At(19, 1)));
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

    [Theory]
    [InlineData(8, 0, 8, 30, true)]
    [InlineData(11, 30, 12, 0, true)]
    [InlineData(16, 30, 17, 0, true)]
    // QA repro: 12:15 is lunch, 19:00 is after hours.
    [InlineData(12, 15, 12, 45, false)]
    [InlineData(19, 0, 19, 30, false)]
    // Straddling the lunch break or the end of the day.
    [InlineData(11, 45, 12, 15, false)]
    [InlineData(16, 45, 17, 15, false)]
    [InlineData(7, 30, 8, 0, false)]
    public void Slot_Must_Sit_Inside_One_Shift(int sh, int sm, int eh, int em, bool fits)
    {
        var windows = DentistShiftChecker.WorkingWindows(null);

        Assert.Equal(fits, DentistShiftChecker.Fits(windows, At(sh, sm), At(eh, em)));
    }

    [Fact]
    public void A_Day_Off_Has_No_Working_Hours()
    {
        var record = Record().RegisterDayOff("Nghỉ phép");

        Assert.Empty(DentistShiftChecker.WorkingWindows(record));
    }

    [Fact]
    public void A_Half_Day_Leave_Is_Taken_Out_Of_Its_Shift()
    {
        var record = Record().RegisterLeave(
            new LeaveWindow(LeaveShift.Morning, new TimeOnly(9, 0), new TimeOnly(10, 0)));

        var windows = DentistShiftChecker.WorkingWindows(record);

        Assert.Equal("08:00-09:00, 10:00-12:00, 13:00-17:00", DentistShiftChecker.Describe(windows));
        Assert.False(DentistShiftChecker.Fits(windows, At(9, 30), At(10, 0)));
    }

    [Fact]
    public void Rescheduled_Shifts_Replace_The_Defaults_And_Touching_Ones_Join()
    {
        var record = Record().RescheduleShifts(
            new WorkShift(WorkShiftKind.Morning, new TimeOnly(9, 0), new TimeOnly(13, 0)),
            new WorkShift(WorkShiftKind.Afternoon, new TimeOnly(13, 0), new TimeOnly(20, 0)));

        var windows = DentistShiftChecker.WorkingWindows(record);

        Assert.Equal("09:00-20:00", DentistShiftChecker.Describe(windows));
        Assert.True(DentistShiftChecker.Fits(windows, At(12, 45), At(13, 15)));
        Assert.True(DentistShiftChecker.Fits(windows, At(19, 0), At(19, 30)));
    }

    [Fact]
    public void A_Slot_Running_Past_Midnight_Never_Fits()
    {
        var windows = DentistShiftChecker.WorkingWindows(null);

        Assert.False(DentistShiftChecker.Fits(windows, At(8, 0), At(8, 0).AddDays(1)));
    }
}
