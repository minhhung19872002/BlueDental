using System;
using BlueDental.Operations.Reports;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.Operations;

/// <summary>
/// The window a report is read through.
///
/// Every report tab hangs off this: pick the wrong boundary and a row lands in
/// the wrong month, or in two windows at once. The reference offers only whole
/// periods, so these are the only four shapes there are.
/// </summary>
public class OperationsReportWindowTests
{
    [Fact]
    public void Day_Should_Cover_That_Day_Only()
    {
        var (start, end) = OperationsReportAppService.WindowOf(
            OperationsReportPeriod.Day,
            new DateTime(2026, 8, 26, 15, 42, 0));

        start.ShouldBe(new DateTime(2026, 8, 26));
        end.ShouldBe(new DateTime(2026, 8, 27));
    }

    [Fact]
    public void Week_Should_Start_On_Monday()
    {
        // A Thursday.
        var (start, end) = OperationsReportAppService.WindowOf(
            OperationsReportPeriod.Week,
            new DateTime(2026, 8, 27));

        start.DayOfWeek.ShouldBe(DayOfWeek.Monday);
        start.ShouldBe(new DateTime(2026, 8, 24));
        end.ShouldBe(new DateTime(2026, 8, 31));
    }

    [Fact]
    public void Week_Should_Treat_Sunday_As_The_Last_Day_Not_The_First()
    {
        var (start, _) = OperationsReportAppService.WindowOf(
            OperationsReportPeriod.Week,
            new DateTime(2026, 8, 30)); // a Sunday

        start.ShouldBe(new DateTime(2026, 8, 24));
    }

    [Fact]
    public void Month_Should_Cover_The_Whole_Month()
    {
        var (start, end) = OperationsReportAppService.WindowOf(
            OperationsReportPeriod.Month,
            new DateTime(2026, 8, 15));

        start.ShouldBe(new DateTime(2026, 8, 1));
        end.ShouldBe(new DateTime(2026, 9, 1));
    }

    [Fact]
    public void Month_Should_Roll_Into_The_Next_Year_In_December()
    {
        var (start, end) = OperationsReportAppService.WindowOf(
            OperationsReportPeriod.Month,
            new DateTime(2026, 12, 9));

        start.ShouldBe(new DateTime(2026, 12, 1));
        end.ShouldBe(new DateTime(2027, 1, 1));
    }

    [Fact]
    public void Year_Should_Cover_The_Whole_Year()
    {
        var (start, end) = OperationsReportAppService.WindowOf(
            OperationsReportPeriod.Year,
            new DateTime(2026, 8, 15));

        start.ShouldBe(new DateTime(2026, 1, 1));
        end.ShouldBe(new DateTime(2027, 1, 1));
    }

    [Fact]
    public void End_Should_Be_Exclusive_So_A_Row_Cannot_Fall_Into_Two_Windows()
    {
        var august = OperationsReportAppService.WindowOf(
            OperationsReportPeriod.Month, new DateTime(2026, 8, 15));
        var september = OperationsReportAppService.WindowOf(
            OperationsReportPeriod.Month, new DateTime(2026, 9, 15));

        august.End.ShouldBe(september.Start);

        // Midnight on 1 September belongs to September alone.
        var boundary = new DateTime(2026, 9, 1);
        (boundary >= august.Start && boundary < august.End).ShouldBeFalse();
        (boundary >= september.Start && boundary < september.End).ShouldBeTrue();
    }
}
