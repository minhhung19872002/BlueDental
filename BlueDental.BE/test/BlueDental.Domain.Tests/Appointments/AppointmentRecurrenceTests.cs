using System;
using System.Linq;
using BlueDental.Appointments.Values;
using Volo.Abp;
using Xunit;

namespace BlueDental.Appointments;

public class AppointmentRecurrenceTests
{
    // Thursday, as in the BA mockup ("Hàng tuần vào thứ Năm", "ngày 8").
    private static readonly DateOnly Thursday = new(2026, 10, 8);

    private static AppointmentRecurrence Rule(
        RecurrenceFrequency frequency,
        int interval = 1,
        int[]? weekDays = null,
        int? count = 6,
        DateOnly? until = null)
        => new(
            frequency,
            interval,
            weekDays,
            until is null ? RecurrenceEnd.AfterCount : RecurrenceEnd.OnDate,
            until is null ? count : null,
            until);

    private static string[] Days(AppointmentRecurrence rule, DateOnly first)
        => rule.DatesFrom(first).Select(d => d.ToString("dd/MM")).ToArray();

    [Fact]
    public void Daily_Starts_On_The_Booking_Date()
    {
        Assert.Equal(
            ["08/10", "09/10", "10/10", "11/10", "12/10", "13/10"],
            Days(Rule(RecurrenceFrequency.Daily), Thursday));
    }

    [Fact]
    public void Every_Second_Day_Skips_One()
    {
        Assert.Equal(
            ["08/10", "10/10", "12/10"],
            Days(Rule(RecurrenceFrequency.Daily, interval: 2, count: 3), Thursday));
    }

    [Fact]
    public void Weekly_Repeats_The_Booking_Weekday()
    {
        Assert.Equal(
            ["08/10", "15/10", "22/10", "29/10", "05/11", "12/11"],
            Days(Rule(RecurrenceFrequency.Weekly), Thursday));
    }

    [Fact]
    public void Weekly_On_Several_Days_Keeps_The_Booking_Weekday_And_Skips_Earlier_Days()
    {
        // Mon + Thu chosen; Monday 05/10 is before the booking so it is not a session.
        var rule = Rule(RecurrenceFrequency.Weekly, weekDays: [1, 4], count: 5);

        Assert.Equal(["08/10", "12/10", "15/10", "19/10", "22/10"], Days(rule, Thursday));
    }

    [Fact]
    public void Weekly_Rule_Includes_The_Booking_Weekday_Even_When_Not_Ticked()
    {
        var rule = Rule(RecurrenceFrequency.Weekly, weekDays: [6], count: 4);

        Assert.Equal(["08/10", "10/10", "15/10", "17/10"], Days(rule, Thursday));
    }

    [Fact]
    public void Every_Second_Week_Skips_A_Week()
    {
        var rule = Rule(RecurrenceFrequency.Weekly, interval: 2, count: 3);

        Assert.Equal(["08/10", "22/10", "05/11"], Days(rule, Thursday));
    }

    [Fact]
    public void Monthly_Repeats_The_Day_Of_The_Month()
    {
        Assert.Equal(
            ["08/10", "08/11", "08/12"],
            Days(Rule(RecurrenceFrequency.Monthly, count: 3), Thursday));
    }

    [Fact]
    public void Monthly_On_The_31st_Falls_Back_To_The_Last_Day_Without_Drifting()
    {
        var rule = Rule(RecurrenceFrequency.Monthly, count: 4);

        Assert.Equal(["31/01", "28/02", "31/03", "30/04"], Days(rule, new DateOnly(2027, 1, 31)));
    }

    [Fact]
    public void Until_Date_Is_Inclusive()
    {
        var rule = Rule(RecurrenceFrequency.Weekly, until: new DateOnly(2026, 10, 29));

        Assert.Equal(["08/10", "15/10", "22/10", "29/10"], Days(rule, Thursday));
    }

    [Fact]
    public void Until_Before_The_Booking_Is_Refused()
    {
        var rule = Rule(RecurrenceFrequency.Daily, until: Thursday.AddDays(-1));

        var ex = Assert.Throws<BusinessException>(() => rule.DatesFrom(Thursday));
        Assert.Equal(BlueDentalDomainErrorCodes.Appointments.InvalidRecurrence, ex.Code);
    }

    [Fact]
    public void More_Than_60_Sessions_Is_Refused()
    {
        var byCount = Assert.Throws<BusinessException>(() => Rule(RecurrenceFrequency.Daily, count: 61));
        Assert.Equal(BlueDentalDomainErrorCodes.Appointments.SeriesTooLong, byCount.Code);

        var byDate = Rule(RecurrenceFrequency.Daily, until: Thursday.AddDays(60));
        var ex = Assert.Throws<BusinessException>(() => byDate.DatesFrom(Thursday));
        Assert.Equal(BlueDentalDomainErrorCodes.Appointments.SeriesTooLong, ex.Code);

        Assert.Equal(60, Rule(RecurrenceFrequency.Daily, until: Thursday.AddDays(59)).DatesFrom(Thursday).Count);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(100)]
    public void Interval_Out_Of_Range_Is_Refused(int interval)
    {
        var ex = Assert.Throws<BusinessException>(() => Rule(RecurrenceFrequency.Daily, interval: interval));
        Assert.Equal(BlueDentalDomainErrorCodes.Appointments.InvalidRecurrence, ex.Code);
    }

    [Fact]
    public void Weekday_Out_Of_Range_Is_Refused()
    {
        Assert.Throws<BusinessException>(() => Rule(RecurrenceFrequency.Weekly, weekDays: [0]));
        Assert.Throws<BusinessException>(() => Rule(RecurrenceFrequency.Weekly, weekDays: [8]));
    }

    [Fact]
    public void Series_Keeps_The_Rule_It_Was_Created_With()
    {
        var rule = Rule(RecurrenceFrequency.Weekly, interval: 2, weekDays: [4, 1], count: 8);
        var series = new AppointmentSeries(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), rule);

        Assert.Equal("1,4", series.WeekDays);
        Assert.Equal(rule.WeekDays, series.Rule.WeekDays);
        Assert.Equal(8, series.Rule.Count);
    }

    // ─── Session state ─────────────────────────────────────────

    private static readonly DateOnly SessionDay = ClinicCalendar.DateOf(DateTimeOffset.UtcNow).AddDays(10);

    private static AppointmentSlot SlotAt(DateOnly day, int hour)
    {
        var start = ClinicCalendar.AtLocal(day, new TimeOnly(hour, 0));
        return new AppointmentSlot(start, start.AddMinutes(30));
    }

    private static Appointment Session() =>
        new Appointment(
                Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
                SlotAt(SessionDay, 9), AppointmentType.FollowUp)
            .JoinSeries(Guid.NewGuid());

    [Fact]
    public void Unchanged_Session_Is_Booked()
    {
        Assert.Equal(SeriesOccurrenceState.Booked, Session().SeriesState());
    }

    [Fact]
    public void New_Time_On_The_Same_Day_Is_Time_Changed()
    {
        var session = Session().Reschedule(SlotAt(SessionDay, 14));

        Assert.Equal(SeriesOccurrenceState.TimeChanged, session.SeriesState());
    }

    [Fact]
    public void Another_Day_Is_Rescheduled()
    {
        var session = Session().Reschedule(SlotAt(SessionDay.AddDays(1), 9));

        Assert.Equal(SeriesOccurrenceState.Rescheduled, session.SeriesState());
    }

    [Fact]
    public void Cancelled_Session_Is_Cancelled()
    {
        var session = Session().Cancel(CancellationReason.PatientRequest, "Bận việc");

        Assert.Equal(SeriesOccurrenceState.Cancelled, session.SeriesState());
    }

    [Fact]
    public void Finished_Session_Cannot_Be_Edited_Or_Deleted()
    {
        var session = Session().Complete();

        Assert.Equal(SeriesOccurrenceState.Finished, session.SeriesState());
        var ex = Assert.Throws<BusinessException>(session.EnsureSeriesSessionEditable);
        Assert.Equal(BlueDentalDomainErrorCodes.Appointments.SeriesSessionFinished, ex.Code);
    }

    [Fact]
    public void A_Finished_Booking_Outside_A_Series_Is_Not_Locked_By_The_Series_Rule()
    {
        var single = new Appointment(
                Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
                SlotAt(SessionDay, 9), AppointmentType.FollowUp)
            .Complete();

        single.EnsureSeriesSessionEditable();
    }
}
