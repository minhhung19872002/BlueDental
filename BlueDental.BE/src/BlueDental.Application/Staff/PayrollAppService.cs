using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Exporting;
using BlueDental.Organizations;
using BlueDental.Permissions;
using BlueDental.Timekeeping;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;

namespace BlueDental.Staff;

/// <summary>
/// Nhân viên → Bảng lương (/staff/payroll). BlueDental-local (Cụm 11 mục 5,
/// with chấm công from mục 6); see docs/clone/pages/payroll.md.
///
/// A month's sheet is built from what the clinic already records — pay terms
/// (<see cref="StaffCompensation"/>), chấm công, the công đoạn steps a dentist
/// ticked off and the fines approved under Chế tài. The arithmetic and the
/// draft / chốt rules live on <see cref="PayrollPeriod"/>.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.Payroll.Read)]
public class PayrollAppService(
    IRepository<PayrollPeriod, Guid> periodRepository,
    IRepository<StaffCompensation, Guid> compensationRepository,
    IRepository<StaffBranchAssignment, Guid> assignmentRepository,
    IRepository<TimeKeepingRecord, Guid> timekeepingRepository,
    IRepository<StaffPenalty, Guid> penaltyRepository,
    IRepository<TreatmentStage, Guid> stageRepository,
    IRepository<TreatmentPlan, Guid> planRepository,
    IRepository<CatalogServiceStage, Guid> catalogStageRepository,
    IIdentityUserRepository userRepository,
    ICurrentClinicBranchResolver branchResolver,
    BranchAccessChecker branchAccess) : ApplicationService, IPayrollAppService
{
    private const decimal DefaultOvertimeRate = 1.5m;

    public async Task<ListResultDto<PayrollPeriodSummaryDto>> GetListAsync(GetPayrollPeriodListInput input)
    {
        var branchFilter = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await periodRepository.WithDetailsAsync(p => p.Entries);
        if (branchFilter.Count > 0) query = query.Where(p => branchFilter.Contains(p.ClinicBranchId));
        if (input.Year.HasValue) query = query.Where(p => p.Year == input.Year.Value);

        var periods = await AsyncExecuter.ToListAsync(query.OrderByDescending(p => p.Year).ThenByDescending(p => p.Month));
        return new ListResultDto<PayrollPeriodSummaryDto>(periods.Select(p => Fill(new PayrollPeriodSummaryDto(), p)).ToList());
    }

    public async Task<PayrollPeriodDto> GetAsync(Guid id) => await MapAsync(await LoadAsync(id));

    [Authorize(BlueDentalAbilityPermissions.Payroll.Create)]
    public async Task<PayrollPeriodDto> CreateAsync(CreatePayrollPeriodDto input)
    {
        var branchId = input.ClinicBranchId ?? branchResolver.GetRequiredClinicBranchId();
        await branchAccess.CheckAsync(branchId);

        if (await periodRepository.AnyAsync(p => p.ClinicBranchId == branchId && p.Year == input.Year && p.Month == input.Month))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Payroll.DuplicatePeriod)
                .WithData("Month", $"{input.Month:00}/{input.Year}");
        }

        var period = new PayrollPeriod(
            GuidGenerator.Create(),
            branchId,
            input.Year,
            input.Month,
            input.StandardWorkDays ?? (input.Month is >= 1 and <= 12 && input.Year is >= 2000 and <= 2100
                ? PayrollPeriod.DefaultStandardWorkDays(input.Year, input.Month)
                : 26m),
            input.OvertimeRate ?? DefaultOvertimeRate);

        period.Recalculate(await BuildInputsAsync(period), GuidGenerator.Create);
        await periodRepository.InsertAsync(period, autoSave: true);
        return await MapAsync(period);
    }

    [Authorize(BlueDentalAbilityPermissions.Payroll.Update)]
    public async Task<PayrollPeriodDto> RecalculateAsync(Guid id)
    {
        var period = await LoadAsync(id);
        period.Recalculate(await BuildInputsAsync(period), GuidGenerator.Create);
        await periodRepository.UpdateAsync(period, autoSave: true);
        return await MapAsync(period);
    }

    [Authorize(BlueDentalAbilityPermissions.Payroll.Update)]
    public async Task<PayrollPeriodDto> UpdateTermsAsync(Guid id, UpdatePayrollTermsDto input)
    {
        var period = await LoadAsync(id);
        period.SetTerms(input.StandardWorkDays, input.OvertimeRate);
        await periodRepository.UpdateAsync(period, autoSave: true);
        return await MapAsync(period);
    }

    [Authorize(BlueDentalAbilityPermissions.Payroll.Update)]
    public async Task<PayrollPeriodDto> UpdateEntryAsync(Guid id, Guid staffId, UpdatePayrollEntryDto input)
    {
        var period = await LoadAsync(id);
        period.UpdateEntry(staffId, input.WorkDaysOverride, input.Bonus, input.OtherDeduction, input.Note);
        await periodRepository.UpdateAsync(period, autoSave: true);
        return await MapAsync(period);
    }

    [Authorize(BlueDentalAbilityPermissions.Payroll.Approve)]
    public async Task<PayrollPeriodDto> FinalizeAsync(Guid id)
    {
        var period = await LoadAsync(id);
        period.Finalize(CurrentUser.GetId(), Clock.Now);
        await periodRepository.UpdateAsync(period, autoSave: true);
        return await MapAsync(period);
    }

    [Authorize(BlueDentalAbilityPermissions.Payroll.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var period = await LoadAsync(id);
        period.EnsureDraft();
        await periodRepository.DeleteAsync(period, autoSave: true);
    }

    [Authorize(BlueDentalAbilityPermissions.Payroll.Export)]
    public async Task<byte[]> ExportAsync(Guid id)
    {
        var period = await MapAsync(await LoadAsync(id));
        string Days(decimal value) => value.ToString("0.##");

        return ExcelSheet.Build(
            "Bang luong",
            L["Payroll:SheetTitle", $"{period.Month:00}/{period.Year}"],
            new List<ExcelColumn<PayrollEntryDto>>
            {
                new(L["Payroll:Col:Staff"], row => row.StaffName, 26),
                new(L["Payroll:Col:BaseSalary"], row => row.BaseSalary, 16),
                new(L["Payroll:Col:WorkDays"], row => Days(row.PayableWorkDays), 12),
                new(L["Payroll:Col:LeaveDays"], row => Days(row.LeaveDays), 12),
                new(L["Payroll:Col:SalaryByWorkDays"], row => row.SalaryByWorkDays, 18),
                new(L["Payroll:Col:Allowance"], row => row.Allowance, 14),
                new(L["Payroll:Col:OvertimeHours"], row => Days(row.OvertimeMinutes / 60m), 12),
                new(L["Payroll:Col:OvertimePay"], row => row.OvertimePay, 14),
                new(L["Payroll:Col:Commission"], row => row.CommissionAmount, 16),
                new(L["Payroll:Col:Bonus"], row => row.Bonus, 14),
                new(L["Payroll:Col:Penalty"], row => row.PenaltyAmount, 14),
                new(L["Payroll:Col:OtherDeduction"], row => row.OtherDeduction, 14),
                new(L["Payroll:Col:NetSalary"], row => row.NetSalary, 18),
                new(L["Payroll:Col:Note"], row => row.Note ?? string.Empty, 24),
            },
            period.Entries,
            L["Payroll:SheetTerms", Days(period.StandardWorkDays), period.OvertimeRate.ToString("0.##")]);
    }

    public async Task<ListResultDto<StaffCompensationDto>> GetCompensationsAsync(GetStaffCompensationListInput input)
    {
        var branchId = input.ClinicBranchId ?? branchResolver.GetRequiredClinicBranchId();
        await branchAccess.CheckAsync(branchId);

        var staff = await BranchStaffAsync(branchId);
        var ids = staff.Select(u => u.Id).ToList();
        var terms = (await compensationRepository.GetListAsync(c => ids.Contains(c.StaffId))).ToDictionary(c => c.StaffId);

        return new ListResultDto<StaffCompensationDto>(staff
            .Select(u => new StaffCompensationDto
            {
                StaffId = u.Id,
                StaffName = FullName(u),
                UserName = u.UserName,
                BaseSalary = terms.GetValueOrDefault(u.Id)?.BaseSalary ?? 0m,
                Allowance = terms.GetValueOrDefault(u.Id)?.Allowance ?? 0m,
            })
            .OrderBy(c => c.StaffName)
            .ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.Payroll.Update)]
    public async Task<StaffCompensationDto> SetCompensationAsync(Guid staffId, SetStaffCompensationDto input)
    {
        // Only someone who may act at one of the staff member's branches sets
        // their pay. A staff member with no branch is clinic-wide (head office,
        // clinic managers), above every branch, so only a clinic-wide caller may
        // — checked before the account is even read, so a refusal names no one.
        var branches = (await assignmentRepository.GetListAsync(a => a.StaffId == staffId)).Select(a => a.ClinicBranchId).ToList();
        var callerIsClinicWide = (await branchAccess.GetAllowedBranchIdsAsync()).Count == 0;
        if (branches.Count == 0 ? !callerIsClinicWide : !await AnyAllowedAsync(branches))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Authorization.CrossBranchAccess);
        }

        var user = await userRepository.GetAsync(staffId);

        var terms = await compensationRepository.FirstOrDefaultAsync(c => c.StaffId == staffId);
        if (terms is null)
        {
            terms = new StaffCompensation(GuidGenerator.Create(), staffId, input.BaseSalary, input.Allowance);
            await compensationRepository.InsertAsync(terms, autoSave: true);
        }
        else
        {
            terms.Set(input.BaseSalary, input.Allowance);
            await compensationRepository.UpdateAsync(terms, autoSave: true);
        }

        return new StaffCompensationDto
        {
            StaffId = staffId,
            StaffName = FullName(user),
            UserName = user.UserName,
            BaseSalary = terms.BaseSalary,
            Allowance = terms.Allowance,
        };
    }

    // ----------------------------------------------------------------------

    private async Task<bool> AnyAllowedAsync(IEnumerable<Guid> branchIds)
    {
        foreach (var branchId in branchIds)
        {
            if (await branchAccess.IsAllowedAsync(branchId)) return true;
        }

        return false;
    }

    private async Task<PayrollPeriod> LoadAsync(Guid id)
    {
        var query = await periodRepository.WithDetailsAsync(p => p.Entries);
        var period = await AsyncExecuter.FirstOrDefaultAsync(query.Where(p => p.Id == id))
            ?? throw new Volo.Abp.Domain.Entities.EntityNotFoundException(typeof(PayrollPeriod), id);
        await branchAccess.CheckAsync(period.ClinicBranchId);
        return period;
    }

    /// <summary>Active staff assigned to the branch: the people on its payroll.</summary>
    private async Task<List<IdentityUser>> BranchStaffAsync(Guid branchId)
    {
        var ids = (await assignmentRepository.GetListAsync(a => a.ClinicBranchId == branchId))
            .Select(a => a.StaffId)
            .Distinct()
            .ToList();
        return (await userRepository.GetListByIdsAsync(ids)).Where(u => u.IsActive).ToList();
    }

    private async Task<List<PayrollInput>> BuildInputsAsync(PayrollPeriod period)
    {
        var staff = await BranchStaffAsync(period.ClinicBranchId);
        var ids = staff.Select(u => u.Id).ToList();
        var first = period.FirstDay;
        var last = period.LastDay;

        var terms = (await compensationRepository.GetListAsync(c => ids.Contains(c.StaffId))).ToDictionary(c => c.StaffId);

        var attendance = (await timekeepingRepository.GetListAsync(r =>
                r.ClinicBranchId == period.ClinicBranchId && ids.Contains(r.StaffId)
                && r.WorkDate >= first && r.WorkDate <= last))
            .GroupBy(r => r.StaffId)
            .ToDictionary(g => g.Key, g => PayrollWorkDays.Of(g));

        var fines = (await penaltyRepository.GetListAsync(p =>
                p.ClinicBranchId == period.ClinicBranchId && ids.Contains(p.StaffId)
                && p.Status == StaffPenaltyStatus.Approved
                && p.ViolationDate >= first && p.ViolationDate <= last))
            .GroupBy(p => p.StaffId)
            .ToDictionary(g => g.Key, g => g.Sum(p => p.FineAmount));

        var commissions = await CommissionsAsync(period, ids);

        return staff.Select(u =>
        {
            var pay = terms.GetValueOrDefault(u.Id);
            var days = attendance.GetValueOrDefault(u.Id) ?? PayrollWorkDays.None;
            return new PayrollInput(
                u.Id,
                FullName(u),
                pay?.BaseSalary ?? 0m,
                pay?.Allowance ?? 0m,
                days.WorkedDays,
                days.LeaveDays,
                days.OvertimeMinutes,
                commissions.GetValueOrDefault(u.Id),
                fines.GetValueOrDefault(u.Id));
        }).ToList();
    }

    /// <summary>
    /// Hoa hồng: every step of a công đoạn ticked done in the month, priced by
    /// the catalogue ("Giá trị" % / VNĐ), paid to the dentist of the công đoạn.
    /// Warranty công đoạn earn nothing; a step flagged "Tính lương cho phòng
    /// MKT" is the marketing team's, not the dentist's, and is left out here.
    /// </summary>
    private async Task<Dictionary<Guid, decimal>> CommissionsAsync(PayrollPeriod period, List<Guid> staffIds)
    {
        var monthStart = ClinicCalendar.StartOfDay(period.FirstDay);
        var monthEnd = ClinicCalendar.StartOfDay(period.LastDay.AddDays(1));

        var stages = (await stageRepository.GetListAsync(s =>
                s.ClinicBranchId == period.ClinicBranchId
                && staffIds.Contains(s.StaffId)
                && !s.IsGuarantee
                && s.StartedAt != null && s.StartedAt < monthEnd
                && (s.CompletedAt == null || s.CompletedAt >= monthStart)))
            .Where(s => s.ServiceItems.Any(i => i.IsCompleted && i.CompletedAt >= monthStart && i.CompletedAt < monthEnd))
            .ToList();
        if (stages.Count == 0) return [];

        var stepIds = stages.SelectMany(s => s.ServiceItems).Select(i => i.CatalogServiceStageId).Distinct().ToList();
        var steps = (await catalogStageRepository.GetListAsync(c => stepIds.Contains(c.Id))).ToDictionary(c => c.Id);

        var lineIds = stages.Select(s => s.TreatmentServiceId).Distinct().ToList();
        var planQuery = await planRepository.WithDetailsAsync(p => p.Services);
        var plans = await AsyncExecuter.ToListAsync(planQuery.Where(p => p.Services.Any(l => lineIds.Contains(l.Id))));
        var lines = plans
            .SelectMany(p => p.Services.Select(l => (Plan: p, Line: l)))
            .Where(x => lineIds.Contains(x.Line.Id))
            .ToDictionary(x => x.Line.Id);

        var totals = new Dictionary<Guid, decimal>();
        foreach (var stage in stages)
        {
            if (!lines.TryGetValue(stage.TreatmentServiceId, out var owner)) continue;
            var charge = owner.Plan.ChargedAmountOf(owner.Line);

            foreach (var item in stage.ServiceItems.Where(i =>
                         i.IsCompleted && i.CompletedAt >= monthStart && i.CompletedAt < monthEnd))
            {
                if (!steps.TryGetValue(item.CatalogServiceStageId, out var step) || step.IsMarketingSalary) continue;

                var amount = PayrollCommission.StepAmount(
                    step.ValueType, step.Value, stage.Teeth.Count, owner.Line.Quantity, charge);
                totals[stage.StaffId] = totals.GetValueOrDefault(stage.StaffId) + amount;
            }
        }

        return totals;
    }

    private async Task<PayrollPeriodDto> MapAsync(PayrollPeriod period)
    {
        var dto = Fill(new PayrollPeriodDto(), period);
        dto.StandardWorkDays = period.StandardWorkDays;
        dto.OvertimeRate = period.OvertimeRate;
        if (period.FinalizedBy is { } finalizer)
        {
            var user = await userRepository.FindAsync(finalizer);
            dto.FinalizedByName = user is null ? null : FullName(user);
        }

        dto.Entries = period.Entries
            .OrderBy(e => e.StaffName)
            .Select(e => new PayrollEntryDto
            {
                StaffId = e.StaffId,
                StaffName = e.StaffName,
                BaseSalary = e.BaseSalary,
                Allowance = e.Allowance,
                WorkedDays = e.WorkedDays,
                LeaveDays = e.LeaveDays,
                WorkDaysOverride = e.WorkDaysOverride,
                PayableWorkDays = e.PayableWorkDays,
                OvertimeMinutes = e.OvertimeMinutes,
                SalaryByWorkDays = e.SalaryByWorkDays,
                OvertimePay = e.OvertimePay,
                CommissionAmount = e.CommissionAmount,
                Bonus = e.Bonus,
                PenaltyAmount = e.PenaltyAmount,
                OtherDeduction = e.OtherDeduction,
                GrossSalary = e.GrossSalary,
                NetSalary = e.NetSalary,
                Note = e.Note,
            })
            .ToList();
        return dto;
    }

    private static T Fill<T>(T dto, PayrollPeriod period) where T : PayrollPeriodSummaryDto
    {
        dto.Id = period.Id;
        dto.ClinicBranchId = period.ClinicBranchId;
        dto.Year = period.Year;
        dto.Month = period.Month;
        dto.Status = period.Status;
        dto.StaffCount = period.Entries.Count;
        dto.NetTotal = period.NetTotal;
        dto.CreationTime = period.CreationTime;
        dto.FinalizedAt = period.FinalizedAt;
        return dto;
    }

    private static string FullName(IdentityUser user) =>
        $"{user.Name} {user.Surname}".Trim() is { Length: > 0 } name ? name : user.UserName ?? string.Empty;
}
