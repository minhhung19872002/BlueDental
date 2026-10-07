using System;
using System.Linq;
using BlueDental.Catalogs;
using BlueDental.Timekeeping;
using BlueDental.Timekeeping.Values;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Staff;

/// <summary>
/// Bảng lương (Cụm 11 mục 5–6): the arithmetic of one row, how chấm công
/// becomes ngày công, how a công đoạn step pays, and the draft / chốt rules.
/// </summary>
public class PayrollTests
{
    private static readonly Guid Branch = Guid.NewGuid();
    private static readonly Guid Staff = Guid.NewGuid();

    private static PayrollPeriod Period(decimal standardDays = 26m, decimal overtimeRate = 1.5m) =>
        new(Guid.NewGuid(), Branch, 2026, 10, standardDays, overtimeRate);

    private static PayrollInput Input(
        decimal baseSalary = 10_400_000m, decimal allowance = 500_000m, decimal workedDays = 26m,
        int overtimeMinutes = 0, decimal commission = 0m, decimal penalty = 0m) =>
        new(Staff, "BS An", baseSalary, allowance, workedDays, 0m, overtimeMinutes, commission, penalty);

    [Fact]
    public void A_Full_Month_Pays_The_Base_Salary_And_Allowance()
    {
        var entry = Period().Recalculate([Input()], Guid.NewGuid).Entries.Single();

        entry.SalaryByWorkDays.ShouldBe(10_400_000m);
        entry.NetSalary.ShouldBe(10_900_000m);
    }

    [Fact]
    public void Fewer_Days_Pay_Their_Share_And_More_Days_Do_Not_Pay_More()
    {
        Period().Recalculate([Input(workedDays: 13m)], Guid.NewGuid).Entries.Single()
            .SalaryByWorkDays.ShouldBe(5_200_000m);
        Period().Recalculate([Input(workedDays: 30m)], Guid.NewGuid).Entries.Single()
            .SalaryByWorkDays.ShouldBe(10_400_000m);
    }

    [Fact]
    public void Overtime_Is_Paid_By_The_Hour_At_The_Rate()
    {
        // 10.400.000 / 26 / 8 = 50.000 an hour; 3 h × 1,5 = 225.000.
        var entry = Period().Recalculate([Input(overtimeMinutes: 180)], Guid.NewGuid).Entries.Single();

        entry.OvertimePay.ShouldBe(225_000m);
    }

    [Fact]
    public void Net_Adds_Commission_And_Bonus_And_Takes_Off_Fines_And_Deductions()
    {
        var period = Period().Recalculate([Input(commission: 2_000_000m, penalty: 300_000m)], Guid.NewGuid);
        var entry = period.UpdateEntry(Staff, null, bonus: 1_000_000m, otherDeduction: 200_000m, note: " tạm ứng ");

        entry.GrossSalary.ShouldBe(10_400_000m + 500_000m + 2_000_000m + 1_000_000m);
        entry.NetSalary.ShouldBe(entry.GrossSalary - 300_000m - 200_000m);
        entry.Note.ShouldBe("tạm ứng");
        period.NetTotal.ShouldBe(entry.NetSalary);
    }

    [Fact]
    public void A_Corrected_Work_Day_Count_Survives_A_Recalculation()
    {
        var period = Period().Recalculate([Input(workedDays: 10m)], Guid.NewGuid);
        period.UpdateEntry(Staff, 20m, 500_000m, 0m, null);

        var entry = period.Recalculate([Input(workedDays: 12m)], Guid.NewGuid).Entries.Single();

        entry.WorkedDays.ShouldBe(12m);
        entry.PayableWorkDays.ShouldBe(20m);
        entry.Bonus.ShouldBe(500_000m);
        entry.SalaryByWorkDays.ShouldBe(8_000_000m);
    }

    [Fact]
    public void Staff_Who_Left_Lose_Their_Row_And_New_Staff_Gain_One()
    {
        var period = Period().Recalculate([Input()], Guid.NewGuid);
        var newcomer = Input() with { StaffId = Guid.NewGuid(), StaffName = "PT Bình" };

        period.Recalculate([newcomer], Guid.NewGuid);

        period.Entries.Select(e => e.StaffName).ShouldBe(["PT Bình"]);
    }

    [Fact]
    public void A_Finalized_Sheet_Is_Frozen()
    {
        var period = Period().Recalculate([Input()], Guid.NewGuid).Finalize(Guid.NewGuid(), DateTime.UtcNow);

        period.Status.ShouldBe(PayrollStatus.Finalized);
        Should.Throw<BusinessException>(() => period.Recalculate([Input()], Guid.NewGuid))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Payroll.NotDraft);
        Should.Throw<BusinessException>(() => period.UpdateEntry(Staff, null, 1m, 0m, null));
        Should.Throw<BusinessException>(() => period.SetTerms(24m, 2m));
    }

    [Theory]
    [InlineData(0, 1.5)]
    [InlineData(32, 1.5)]
    [InlineData(26, 0.5)]
    public void Terms_Out_Of_Range_Are_Refused(decimal standardDays, decimal rate)
    {
        Should.Throw<BusinessException>(() => Period(standardDays, rate))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Payroll.InvalidTerms);
    }

    [Fact]
    public void The_Default_Standard_Is_Every_Day_But_Sunday()
    {
        // October 2026: 31 days, 4 Sundays.
        PayrollPeriod.DefaultStandardWorkDays(2026, 10).ShouldBe(27m);
    }

    [Fact]
    public void A_Negative_Salary_Is_Refused()
    {
        Should.Throw<BusinessException>(() => new StaffCompensation(Guid.NewGuid(), Staff, -1m, 0m))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Payroll.InvalidCompensation);
    }

    // --- chấm công → ngày công (mục 6) ----------------------------------------

    private static DateTimeOffset At(DateOnly day, int hour) =>
        new(new DateTime(day.Year, day.Month, day.Day, hour, 0, 0), TimeSpan.FromHours(7));

    private static TimeKeepingRecord Day(DateOnly day) => TimeKeepingRecord.OpenDay(Guid.NewGuid(), Staff, Branch, day);

    [Fact]
    public void Each_Shift_Clocked_In_And_Out_Is_Half_A_Day()
    {
        var full = Day(new DateOnly(2026, 10, 1))
            .CheckIn(WorkShiftKind.Morning, At(new DateOnly(2026, 10, 1), 8))
            .CheckOut(WorkShiftKind.Morning, At(new DateOnly(2026, 10, 1), 12))
            .CheckIn(WorkShiftKind.Afternoon, At(new DateOnly(2026, 10, 1), 13))
            .CheckOut(WorkShiftKind.Afternoon, At(new DateOnly(2026, 10, 1), 17))
            .AddOvertime(90);
        var abandoned = Day(new DateOnly(2026, 10, 2))
            .CheckIn(WorkShiftKind.Morning, At(new DateOnly(2026, 10, 2), 8))
            .CheckOut(WorkShiftKind.Morning, At(new DateOnly(2026, 10, 2), 12))
            .CheckIn(WorkShiftKind.Afternoon, At(new DateOnly(2026, 10, 2), 13));
        var leave = Day(new DateOnly(2026, 10, 3))
            .RegisterLeave(new LeaveWindow(LeaveShift.FullDay, new TimeOnly(8, 0), new TimeOnly(17, 0)));

        var days = PayrollWorkDays.Of([full, abandoned, leave]);

        days.WorkedDays.ShouldBe(1.5m);
        days.LeaveDays.ShouldBe(1m);
        days.OvertimeMinutes.ShouldBe(90);
    }

    [Fact]
    public void No_Chấm_Công_Is_No_Days()
    {
        PayrollWorkDays.Of([]).ShouldBe(PayrollWorkDays.None);
    }

    // --- hoa hồng công đoạn (mục 5) -------------------------------------------

    [Fact]
    public void A_Percent_Step_Pays_Its_Share_Of_What_The_Teeth_It_Covers_Are_Charged()
    {
        // 4 teeth sold for 8.000.000 after discounts; the công đoạn covers 2: 10 % of 4.000.000.
        PayrollCommission.StepAmount(ServiceStageValueType.Percentage, 10m, 2, 4, 8_000_000m).ShouldBe(400_000m);
    }

    [Fact]
    public void An_Amount_Step_Pays_Per_Unit_And_Never_More_Units_Than_Were_Sold()
    {
        PayrollCommission.StepAmount(ServiceStageValueType.Amount, 150_000m, 3, 2, 5_000_000m).ShouldBe(300_000m);
        PayrollCommission.StepAmount(ServiceStageValueType.Amount, 150_000m, 0, 1, 5_000_000m).ShouldBe(150_000m);
    }
}
