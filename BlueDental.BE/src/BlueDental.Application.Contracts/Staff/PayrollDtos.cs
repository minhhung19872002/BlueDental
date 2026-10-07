using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Staff;

/// <summary>
/// Nhân viên → Bảng lương (/staff/payroll). BlueDental-local (Cụm 11 mục 5,
/// with chấm công from mục 6); see docs/clone/pages/payroll.md.
/// </summary>
public interface IPayrollAppService : IApplicationService
{
    Task<ListResultDto<PayrollPeriodSummaryDto>> GetListAsync(GetPayrollPeriodListInput input);
    Task<PayrollPeriodDto> GetAsync(Guid id);
    Task<PayrollPeriodDto> CreateAsync(CreatePayrollPeriodDto input);
    Task<PayrollPeriodDto> RecalculateAsync(Guid id);
    Task<PayrollPeriodDto> UpdateTermsAsync(Guid id, UpdatePayrollTermsDto input);
    Task<PayrollPeriodDto> UpdateEntryAsync(Guid id, Guid staffId, UpdatePayrollEntryDto input);
    Task<PayrollPeriodDto> FinalizeAsync(Guid id);
    Task DeleteAsync(Guid id);
    Task<byte[]> ExportAsync(Guid id);

    Task<ListResultDto<StaffCompensationDto>> GetCompensationsAsync(GetStaffCompensationListInput input);
    Task<StaffCompensationDto> SetCompensationAsync(Guid staffId, SetStaffCompensationDto input);
}

public class GetPayrollPeriodListInput
{
    public Guid? ClinicBranchId { get; set; }
    public int? Year { get; set; }
}

public class PayrollPeriodSummaryDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public PayrollStatus Status { get; set; }
    public int StaffCount { get; set; }
    public decimal NetTotal { get; set; }
    public DateTime CreationTime { get; set; }
    public DateTime? FinalizedAt { get; set; }
}

public class PayrollPeriodDto : PayrollPeriodSummaryDto
{
    public decimal StandardWorkDays { get; set; }
    public decimal OvertimeRate { get; set; }
    public string? FinalizedByName { get; set; }
    public List<PayrollEntryDto> Entries { get; set; } = [];
}

public class PayrollEntryDto
{
    public Guid StaffId { get; set; }
    public string StaffName { get; set; } = string.Empty;
    public decimal BaseSalary { get; set; }
    public decimal Allowance { get; set; }
    public decimal WorkedDays { get; set; }
    public decimal LeaveDays { get; set; }
    public decimal? WorkDaysOverride { get; set; }
    public decimal PayableWorkDays { get; set; }
    public int OvertimeMinutes { get; set; }
    public decimal SalaryByWorkDays { get; set; }
    public decimal OvertimePay { get; set; }
    public decimal CommissionAmount { get; set; }
    public decimal Bonus { get; set; }
    public decimal PenaltyAmount { get; set; }
    public decimal OtherDeduction { get; set; }
    public decimal GrossSalary { get; set; }
    public decimal NetSalary { get; set; }
    public string? Note { get; set; }
}

public class CreatePayrollPeriodDto
{
    /// <summary>The branch; the caller's current one when omitted.</summary>
    public Guid? ClinicBranchId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }

    /// <summary>Mon–Sat of the month when omitted.</summary>
    public decimal? StandardWorkDays { get; set; }

    /// <summary>1.5 when omitted.</summary>
    public decimal? OvertimeRate { get; set; }
}

public class UpdatePayrollTermsDto
{
    public decimal StandardWorkDays { get; set; }
    public decimal OvertimeRate { get; set; }
}

public class UpdatePayrollEntryDto
{
    /// <summary>A corrected ngày công; null keeps the one chấm công gives.</summary>
    public decimal? WorkDaysOverride { get; set; }
    public decimal Bonus { get; set; }
    public decimal OtherDeduction { get; set; }
    public string? Note { get; set; }
}

public class GetStaffCompensationListInput
{
    public Guid? ClinicBranchId { get; set; }
}

public class StaffCompensationDto
{
    public Guid StaffId { get; set; }
    public string StaffName { get; set; } = string.Empty;
    public string? UserName { get; set; }
    public decimal BaseSalary { get; set; }
    public decimal Allowance { get; set; }
}

public class SetStaffCompensationDto
{
    public decimal BaseSalary { get; set; }
    public decimal Allowance { get; set; }
}
