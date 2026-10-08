using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Exporting;
using BlueDental.Organizations;
using BlueDental.Permissions;
using BlueDental.Reporting;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.CustomerCare;

/// <summary>
/// Báo cáo chăm sóc khách hàng (checklist 16.11), a tab of /report.
/// BlueDental-local; see docs/clone/pages/report.md.
///
/// Each care type is read through <see cref="CareRecordWindow"/>, the window its
/// /cskh-grouping tab uses, so a type's total here is the row count of that tab
/// for the same period.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.ReportCare.Read)]
public class CareReportAppService(
    IRepository<CareRecord, Guid> repository,
    IIdentityUserRepository userRepository,
    CareRecordWindow window,
    BranchAccessChecker branchAccess) : BlueDentalAppService, ICareReportAppService
{
    /// <summary>The tabs of /cskh-grouping, in their order.</summary>
    private static readonly CareType[] BoardTypes =
    [
        CareType.AfterTreatment,
        CareType.Birthday,
        CareType.AppointmentReminder,
        CareType.NoService,
        CareType.MissedAppointment,
        CareType.CancelledAppointment,
        CareType.Periodic,
        CareType.Special,
        CareType.Complaint,
    ];

    public async Task<CareReportDto> GetAsync(ClinicReportQueryDto input)
    {
        var branchFilter = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        DateTimeOffset? from = input.FromDate is { } f ? ClinicCalendar.StartOfDay(f) : null;
        DateTimeOffset? to = input.ToDate is { } t ? ClinicCalendar.StartOfDay(t.AddDays(1)).AddTicks(-1) : null;

        var records = new List<CareFacts>();
        foreach (var type in BoardTypes)
        {
            var query = (await repository.GetQueryableAsync()).Where(r => r.Type == type);
            if (branchFilter.Count > 0) query = query.Where(r => branchFilter.Contains(r.BranchId));

            var windowed = await window.ApplyAsync(query, type, branchFilter, from, to);
            records.AddRange(await AsyncExecuter.ToListAsync(windowed.Records
                .Select(r => new CareFacts(r.Type, r.Status, r.Outcome, r.ZaloSentAt != null, r.CareStaffId))));
        }

        var staffNames = await StaffNamesAsync(records.Select(r => r.CareStaffId));

        return new CareReportDto
        {
            Summary = Count(new CareReportRowDto(), records),
            ByType = [.. BoardTypes.Select(type => Count(
                new CareTypeReportRowDto { Type = type }, records.Where(r => r.Type == type)))],
            ByOutcome = new CareOutcomeCountsDto
            {
                // Only a Thành công carries a rating; an open task is not "chưa đánh giá".
                NotRated = records.Count(r => r.Status == CareStatus.Succeeded && r.Outcome == CareOutcome.NotRated),
                Good = records.Count(r => r.Outcome == CareOutcome.Good),
                Fair = records.Count(r => r.Outcome == CareOutcome.Fair),
                Normal = records.Count(r => r.Outcome == CareOutcome.Normal),
                Complaint = records.Count(r => r.Outcome == CareOutcome.Complaint),
            },
            ByStaff = [.. records
                .GroupBy(r => r.CareStaffId)
                .Select(g => Count(new CareStaffReportRowDto
                {
                    StaffId = g.Key,
                    Name = g.Key is { } id ? staffNames.GetValueOrDefault(id) : null,
                }, g))
                .OrderBy(r => r.StaffId is null)
                .ThenByDescending(r => r.Total)],
        };
    }

    [Authorize(BlueDentalAbilityPermissions.ReportCare.Export)]
    public async Task<byte[]> ExportAsync(ClinicReportQueryDto input)
    {
        var report = await GetAsync(input);

        var rows = new List<(string Group, string Name, CareReportRowDto Row)>();
        rows.AddRange(report.ByType.Select(r => (L["Report:Care:ByType"].Value, L[$"CSKH:Type:{r.Type}"].Value, (CareReportRowDto)r)));
        rows.AddRange(report.ByStaff.Select(r => (L["Report:Care:ByStaff"].Value,
            r.Name ?? L["Report:Care:NoStaff"].Value, (CareReportRowDto)r)));
        rows.Add((L["Report:Total"].Value, string.Empty, report.Summary));

        return ExcelSheet.Build(
            "CSKH",
            L["BE:Perm:ReportCare"],
            new List<ExcelColumn<(string Group, string Name, CareReportRowDto Row)>>
            {
                new(L["Report:Col:Group"], x => x.Group, 18),
                new(L["Report:Col:Name"], x => x.Name, 30),
                new(L["Report:Care:Total"], x => x.Row.Total, 12),
                new(L["Report:Care:New"], x => x.Row.New, 14),
                new(L["Report:Care:Contacted"], x => x.Row.Contacted, 14),
                new(L["Report:Care:Succeeded"], x => x.Row.Succeeded, 14),
                new(L["Report:Care:Failed"], x => x.Row.Failed, 12),
                new(L["Report:Care:Cancelled"], x => x.Row.Cancelled, 12),
                new(L["Report:Care:ZaloSent"], x => x.Row.ZaloSent, 12),
                new(L["Report:Care:DoneRate"], x => DonePercent(x.Row), 16),
            },
            rows,
            PeriodLabel(input));
    }

    /// <summary>Đã chăm sóc: reached in any way, out of the tasks that were not cancelled.</summary>
    private static decimal DonePercent(CareReportRowDto row)
    {
        var open = row.Total - row.Cancelled;
        return open == 0 ? 0 : Math.Round(100m * (row.Contacted + row.Succeeded + row.Failed) / open, 1);
    }

    private static T Count<T>(T row, IEnumerable<CareFacts> records) where T : CareReportRowDto
    {
        foreach (var r in records)
        {
            row.Total++;
            switch (r.Status)
            {
                case CareStatus.New: row.New++; break;
                case CareStatus.Contacted: row.Contacted++; break;
                case CareStatus.Succeeded: row.Succeeded++; break;
                case CareStatus.Failed: row.Failed++; break;
                case CareStatus.Cancelled: row.Cancelled++; break;
            }

            if (r.ZaloSent) row.ZaloSent++;
        }

        return row;
    }

    private async Task<Dictionary<Guid, string>> StaffNamesAsync(IEnumerable<Guid?> ids)
    {
        var userIds = ids.OfType<Guid>().Distinct().ToList();
        if (userIds.Count == 0) return [];

        // Staff removed since still name the care they did.
        List<IdentityUser> users;
        using (DataFilter.Disable<ISoftDelete>())
            users = await userRepository.GetListByIdsAsync(userIds);

        return users.ToDictionary(u => u.Id, u =>
        {
            var fullName = string.Join(" ", new[] { u.Surname, u.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
            return string.IsNullOrWhiteSpace(fullName) ? u.UserName : fullName;
        });
    }

    private static string PeriodLabel(ClinicReportQueryDto input) =>
        !input.FromDate.HasValue && !input.ToDate.HasValue
            ? "Toàn bộ thời gian"
            : $"Từ {input.FromDate:dd/MM/yyyy} đến {input.ToDate:dd/MM/yyyy}";

    private sealed record CareFacts(
        CareType Type, CareStatus Status, CareOutcome Outcome, bool ZaloSent, Guid? CareStaffId);
}
