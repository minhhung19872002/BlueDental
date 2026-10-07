using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Staff;

/// <summary>
/// What the calculation feeds one staff member's row of a month: everything
/// the clinic records elsewhere — pay terms, chấm công, công đoạn, chế tài.
/// </summary>
public sealed record PayrollInput(
    Guid StaffId,
    string StaffName,
    decimal BaseSalary,
    decimal Allowance,
    decimal WorkedDays,
    decimal LeaveDays,
    int OvertimeMinutes,
    decimal CommissionAmount,
    decimal PenaltyAmount);

/// <summary>
/// "Bảng lương" of one branch for one month (Cụm 11 mục 5, with chấm công
/// from mục 6). BlueDental-local — docs/clone/pages/payroll.md.
///
/// While it is a draft every row is worked out again from what the clinic
/// recorded (<see cref="Recalculate"/>); the hand-entered parts — a corrected
/// ngày công, Thưởng, Khấu trừ khác, Ghi chú — survive that. "Chốt" freezes
/// the sheet: nothing recalculates or edits it afterwards.
/// </summary>
public class PayrollPeriod : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }
    public int Year { get; private set; }
    public int Month { get; private set; }

    /// <summary>"Ngày công chuẩn" — the days a full base salary pays for.</summary>
    public decimal StandardWorkDays { get; private set; }

    /// <summary>"Hệ số tăng ca" — overtime hours are paid at this multiple of the hourly rate.</summary>
    public decimal OvertimeRate { get; private set; }

    public PayrollStatus Status { get; private set; }
    public DateTime? FinalizedAt { get; private set; }
    public Guid? FinalizedBy { get; private set; }

    private readonly List<PayrollEntry> _entries = [];
    public IReadOnlyCollection<PayrollEntry> Entries => _entries.AsReadOnly();

    protected PayrollPeriod() { }

    public PayrollPeriod(Guid id, Guid clinicBranchId, int year, int month, decimal standardWorkDays, decimal overtimeRate)
        : base(id)
    {
        if (year is < 2000 or > 2100 || month is < 1 or > 12)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Payroll.InvalidPeriod);
        }

        ClinicBranchId = clinicBranchId;
        Year = year;
        Month = month;
        Status = PayrollStatus.Draft;
        SetTerms(standardWorkDays, overtimeRate);
    }

    public DateOnly FirstDay => new(Year, Month, 1);
    public DateOnly LastDay => FirstDay.AddMonths(1).AddDays(-1);

    /// <summary>Mon–Sat of the month: the default "ngày công chuẩn" (Sunday off).</summary>
    public static decimal DefaultStandardWorkDays(int year, int month)
    {
        var first = new DateOnly(year, month, 1);
        var days = first.AddMonths(1).DayNumber - first.DayNumber;
        return Enumerable.Range(0, days).Count(d => first.AddDays(d).DayOfWeek != DayOfWeek.Sunday);
    }

    public PayrollPeriod SetTerms(decimal standardWorkDays, decimal overtimeRate)
    {
        EnsureDraft();
        if (standardWorkDays is <= 0m or > 31m || overtimeRate is < 1m or > 5m)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Payroll.InvalidTerms);
        }

        StandardWorkDays = standardWorkDays;
        OvertimeRate = overtimeRate;
        foreach (var entry in _entries) entry.Recalculate(StandardWorkDays, OvertimeRate);
        return this;
    }

    /// <summary>
    /// Replaces the computed part of every row with fresh figures. A staff
    /// member who left the inputs loses their row; a new one gains one; the
    /// hand-entered parts of the rest are kept.
    /// </summary>
    public PayrollPeriod Recalculate(IEnumerable<PayrollInput> inputs, Func<Guid> newId)
    {
        EnsureDraft();
        var fresh = inputs.ToDictionary(i => i.StaffId);

        _entries.RemoveAll(e => !fresh.ContainsKey(e.StaffId));
        foreach (var input in fresh.Values)
        {
            var entry = _entries.FirstOrDefault(e => e.StaffId == input.StaffId);
            if (entry is null)
            {
                entry = new PayrollEntry(newId(), Id, input.StaffId);
                _entries.Add(entry);
            }

            entry.Apply(input, StandardWorkDays, OvertimeRate);
        }

        return this;
    }

    public PayrollEntry UpdateEntry(
        Guid staffId, decimal? workDaysOverride, decimal bonus, decimal otherDeduction, string? note)
    {
        EnsureDraft();
        var entry = _entries.FirstOrDefault(e => e.StaffId == staffId)
            ?? throw new EntityNotFoundException(typeof(PayrollEntry), staffId);
        entry.Adjust(workDaysOverride, bonus, otherDeduction, note, StandardWorkDays, OvertimeRate);
        return entry;
    }

    public PayrollPeriod Finalize(Guid userId, DateTime now)
    {
        EnsureDraft();
        Status = PayrollStatus.Finalized;
        FinalizedAt = now;
        FinalizedBy = userId;
        return this;
    }

    public void EnsureDraft()
    {
        if (Status != PayrollStatus.Draft)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Payroll.NotDraft);
        }
    }

    public decimal NetTotal => _entries.Sum(e => e.NetSalary);
}

/// <summary>One staff member's row of a <see cref="PayrollPeriod"/>.</summary>
public class PayrollEntry : Entity<Guid>
{
    public Guid PayrollPeriodId { get; private set; }
    public Guid StaffId { get; private set; }
    public string StaffName { get; private set; } = string.Empty;

    // --- copied in by Recalculate ------------------------------------------
    public decimal BaseSalary { get; private set; }
    public decimal Allowance { get; private set; }
    /// <summary>Ngày công from chấm công: half a day per shift clocked in and out.</summary>
    public decimal WorkedDays { get; private set; }
    /// <summary>Days registered off (nghỉ phép), half a day per half-day leave.</summary>
    public decimal LeaveDays { get; private set; }
    public int OvertimeMinutes { get; private set; }
    /// <summary>Hoa hồng: the công đoạn steps this dentist completed in the month.</summary>
    public decimal CommissionAmount { get; private set; }
    /// <summary>Approved Phạt tiền of the month.</summary>
    public decimal PenaltyAmount { get; private set; }

    // --- entered by hand, kept across Recalculate --------------------------
    /// <summary>A corrected ngày công, when chấm công does not tell the whole story.</summary>
    public decimal? WorkDaysOverride { get; private set; }
    public decimal Bonus { get; private set; }
    public decimal OtherDeduction { get; private set; }
    public string? Note { get; private set; }

    // --- worked out ---------------------------------------------------------
    public decimal SalaryByWorkDays { get; private set; }
    public decimal OvertimePay { get; private set; }
    public decimal GrossSalary { get; private set; }
    public decimal NetSalary { get; private set; }

    public decimal PayableWorkDays => WorkDaysOverride ?? WorkedDays;

    protected PayrollEntry() { }

    internal PayrollEntry(Guid id, Guid payrollPeriodId, Guid staffId) : base(id)
    {
        PayrollPeriodId = payrollPeriodId;
        StaffId = staffId;
    }

    internal void Apply(PayrollInput input, decimal standardWorkDays, decimal overtimeRate)
    {
        StaffName = input.StaffName;
        BaseSalary = input.BaseSalary;
        Allowance = input.Allowance;
        WorkedDays = input.WorkedDays;
        LeaveDays = input.LeaveDays;
        OvertimeMinutes = input.OvertimeMinutes;
        CommissionAmount = input.CommissionAmount;
        PenaltyAmount = input.PenaltyAmount;
        Recalculate(standardWorkDays, overtimeRate);
    }

    internal void Adjust(
        decimal? workDaysOverride, decimal bonus, decimal otherDeduction, string? note,
        decimal standardWorkDays, decimal overtimeRate)
    {
        if (workDaysOverride is < 0m or > 31m || bonus < 0m || otherDeduction < 0m)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Payroll.InvalidAdjustment);
        }

        WorkDaysOverride = workDaysOverride;
        Bonus = bonus;
        OtherDeduction = otherDeduction;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        Recalculate(standardWorkDays, overtimeRate);
    }

    /// <summary>
    /// Lương theo ngày công = lương cơ bản × ngày công / ngày công chuẩn, never
    /// more than the full salary (days beyond the standard are tăng ca, paid by
    /// the hour). Tiền tăng ca = giờ tăng ca × (lương cơ bản / ngày công chuẩn / 8) × hệ số.
    /// Thực lĩnh = lương theo ngày công + phụ cấp + tăng ca + hoa hồng + thưởng
    /// − phạt − khấu trừ khác.
    /// </summary>
    internal void Recalculate(decimal standardWorkDays, decimal overtimeRate)
    {
        var days = Math.Min(PayableWorkDays, standardWorkDays);
        SalaryByWorkDays = Vnd.Round(BaseSalary * days / standardWorkDays);

        var hourly = BaseSalary / standardWorkDays / 8m;
        OvertimePay = Vnd.Round(hourly * OvertimeMinutes / 60m * overtimeRate);

        GrossSalary = SalaryByWorkDays + Allowance + OvertimePay + CommissionAmount + Bonus;
        NetSalary = GrossSalary - PenaltyAmount - OtherDeduction;
    }
}
