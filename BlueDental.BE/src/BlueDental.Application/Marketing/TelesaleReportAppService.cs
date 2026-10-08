using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Exporting;
using BlueDental.Organizations;
using BlueDental.Permissions;
using BlueDental.Reporting;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Marketing;

/// <summary>
/// Báo cáo Telesale - follow khách hàng (checklist 16.8), a tab of /report.
/// BlueDental-local; see docs/clone/pages/report.md.
///
/// The period picks the tickets by the day they were received; each is counted
/// in the state it is in today, so "Đã đến" is how many of that period's leads
/// have walked in so far. A report reader sees every telesale's tickets — the
/// own-tickets scope of /marketing/tickets does not apply here.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.ReportTelesale.Read)]
public class TelesaleReportAppService(
    IRepository<Ticket, Guid> ticketRepository,
    IRepository<TicketImportFile, Guid> fileRepository,
    IRepository<Taxonomy, Guid> taxonomyRepository,
    TicketMapper mapper,
    BranchAccessChecker branchAccess) : BlueDentalAppService, ITelesaleReportAppService
{
    public async Task<TelesaleReportDto> GetAsync(ClinicReportQueryDto input)
    {
        var branchFilter = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var now = Clock.Now;

        var tickets = await AsyncExecuter.ToListAsync(TicketListQuery.ApplyFilters(
                await ticketRepository.GetQueryableAsync(),
                new GetTicketListInput { FromDate = input.FromDate, ToDate = input.ToDate },
                branchFilter, ownerScope: null, now)
            .Select(t => new TicketFacts(
                t.Status, t.SourceTaxonomyId, t.Channel, t.IsReturningCustomer,
                t.AssigneeId, t.ReceivedAt, t.DueAt)));

        var sourceNames = await SourceNamesAsync(tickets.Select(t => t.SourceId));
        // A telesale removed since still names the tickets they worked; without
        // this they would read as the unassigned pool.
        Dictionary<Guid, string> assigneeNames;
        using (DataFilter.Disable<ISoftDelete>())
            assigneeNames = await mapper.UserNamesAsync(tickets.Select(t => t.AssigneeId));

        return new TelesaleReportDto
        {
            Summary = Count(new TelesaleBreakdownRowDto(), tickets, now),
            ByDay = [.. tickets
                .GroupBy(t => ClinicCalendar.DateOf(new DateTimeOffset(DateTime.SpecifyKind(t.ReceivedAt, DateTimeKind.Utc))))
                .OrderBy(g => g.Key)
                .Select(g => new TelesaleDayPointDto
                {
                    Date = g.Key,
                    Total = g.Count(),
                    Booked = g.Count(t => t.Status == TicketStatus.Booked),
                    Arrived = g.Count(t => t.Status == TicketStatus.Arrived),
                })],
            BySource = [.. tickets
                .GroupBy(t => t.SourceId)
                .Select(g => Count(new TelesaleBreakdownRowDto
                {
                    Id = g.Key,
                    Name = g.Key is { } id ? sourceNames.GetValueOrDefault(id) : null,
                }, g, now))
                .OrderByDescending(r => r.Total)],
            ByChannel = [.. tickets
                .GroupBy(t => t.Channel)
                .OrderBy(g => g.Key)
                .Select(g => Count(new TelesaleChannelRowDto { Channel = g.Key }, g, now))],
            ByCustomerType = [.. new[] { false, true }
                .Select(returning => Count(
                    new TelesaleCustomerTypeRowDto { IsReturningCustomer = returning },
                    tickets.Where(t => t.IsReturningCustomer == returning), now))],
            ByFile = await FilesAsync(input, branchFilter, now),
            ByAssignee = [.. tickets
                .GroupBy(t => t.AssigneeId)
                .Select(g => Count(new TelesaleBreakdownRowDto
                {
                    Id = g.Key,
                    Name = g.Key is { } id ? assigneeNames.GetValueOrDefault(id) : null,
                }, g, now))
                .OrderByDescending(r => r.Total)],
        };
    }

    [Authorize(BlueDentalAbilityPermissions.ReportTelesale.Export)]
    public async Task<byte[]> ExportAsync(ClinicReportQueryDto input)
    {
        var report = await GetAsync(input);
        var noSource = L["Report:Telesale:NoSource"].Value;
        var unassigned = L["Report:Telesale:Unassigned"].Value;

        var rows = new List<(string Group, string Name, TelesaleBreakdownRowDto Row)>();
        rows.AddRange(report.BySource.Select(r => (L["Report:Telesale:BySource"].Value, r.Name ?? noSource, r)));
        rows.AddRange(report.ByChannel.Select(r => (L["Report:Telesale:ByChannel"].Value, L[$"Ticket:Channel:{r.Channel}"].Value, (TelesaleBreakdownRowDto)r)));
        rows.AddRange(report.ByCustomerType.Select(r => (L["Report:Telesale:ByCustomerType"].Value,
            L[r.IsReturningCustomer ? "Report:Telesale:Returning" : "Report:Telesale:New"].Value, (TelesaleBreakdownRowDto)r)));
        rows.AddRange(report.ByFile.Select(r => (L["Report:Telesale:ByFile"].Value, r.Name ?? string.Empty, (TelesaleBreakdownRowDto)r)));
        rows.AddRange(report.ByAssignee.Select(r => (L["Report:Telesale:ByAssignee"].Value, r.Name ?? unassigned, r)));
        rows.Add((L["Report:Total"].Value, string.Empty, report.Summary));

        return ExcelSheet.Build(
            "Telesale",
            L["BE:Perm:ReportTelesale"],
            new List<ExcelColumn<(string Group, string Name, TelesaleBreakdownRowDto Row)>>
            {
                new(L["Report:Col:Group"], x => x.Group, 18),
                new(L["Report:Col:Name"], x => x.Name, 30),
                new(L["Report:Telesale:Total"], x => x.Row.Total, 12),
                new(L["Ticket:Status:New"], x => x.Row.New, 12),
                new(L["Ticket:Status:InCare"], x => x.Row.InCare, 14),
                new(L["Ticket:Status:Booked"], x => x.Row.Booked, 14),
                new(L["Ticket:Status:Arrived"], x => x.Row.Arrived, 12),
                new(L["Ticket:Status:NotPotential"], x => x.Row.NotPotential, 16),
                new(L["Report:Telesale:Overdue"], x => x.Row.Overdue, 12),
                new(L["Report:Telesale:Conversion"], x => ConversionPercent(x.Row), 16),
            },
            rows,
            PeriodLabel(input));
    }

    /// <summary>Đặt lịch rate: booked or already arrived, out of every lead of the slice.</summary>
    private static decimal ConversionPercent(TelesaleBreakdownRowDto row) =>
        row.Total == 0 ? 0 : Math.Round(100m * (row.Booked + row.Arrived) / row.Total, 1);

    private static T Count<T>(T row, IEnumerable<TicketFacts> tickets, DateTime now)
        where T : TelesaleBreakdownRowDto
    {
        foreach (var t in tickets)
        {
            row.Total++;
            switch (t.Status)
            {
                case TicketStatus.New: row.New++; break;
                case TicketStatus.InCare: row.InCare++; break;
                case TicketStatus.Booked: row.Booked++; break;
                case TicketStatus.Arrived: row.Arrived++; break;
                case TicketStatus.NotPotential: row.NotPotential++; break;
            }

            if (t.DueAt < now && t.Status is TicketStatus.New or TicketStatus.InCare) row.Overdue++;
        }

        return row;
    }

    /// <summary>The files uploaded in the period, with their tickets as they stand today.</summary>
    private async Task<List<TelesaleFileRowDto>> FilesAsync(
        ClinicReportQueryDto input, IReadOnlyList<Guid> branchFilter, DateTime now)
    {
        var files = (await fileRepository.GetQueryableAsync()).AsQueryable();
        if (branchFilter.Count > 0) files = files.Where(f => branchFilter.Contains(f.ClinicBranchId));
        if (input.FromDate is { } from)
        {
            var start = ClinicCalendar.StartOfDay(from).UtcDateTime;
            files = files.Where(f => f.CreationTime >= start);
        }

        if (input.ToDate is { } to)
        {
            var end = ClinicCalendar.StartOfDay(to.AddDays(1)).UtcDateTime;
            files = files.Where(f => f.CreationTime < end);
        }

        var list = await AsyncExecuter.ToListAsync(files.OrderByDescending(f => f.CreationTime));
        if (list.Count == 0) return [];

        var ids = list.Select(f => f.Id).ToList();
        var tickets = (await AsyncExecuter.ToListAsync((await ticketRepository.GetQueryableAsync())
                .Where(t => t.ImportFileId != null && ids.Contains(t.ImportFileId.Value))
                .Select(t => new { t.ImportFileId, Facts = new TicketFacts(
                    t.Status, t.SourceTaxonomyId, t.Channel, t.IsReturningCustomer,
                    t.AssigneeId, t.ReceivedAt, t.DueAt) })))
            .ToLookup(t => t.ImportFileId!.Value, t => t.Facts);

        return [.. list.Select(f => Count(new TelesaleFileRowDto
        {
            Id = f.Id,
            Name = f.FileName,
            ImportedAt = f.CreationTime,
            RowCount = f.RowCount,
            CreatedCount = f.CreatedCount,
            ReoccurredCount = f.ReoccurredCount,
        }, tickets[f.Id], now))];
    }

    private async Task<Dictionary<Guid, string>> SourceNamesAsync(IEnumerable<Guid?> ids)
    {
        var sourceIds = ids.OfType<Guid>().Distinct().ToList();
        if (sourceIds.Count == 0) return [];

        // A source deleted from Danh mục since still names its old tickets.
        using (DataFilter.Disable<ISoftDelete>())
        {
            return (await AsyncExecuter.ToListAsync((await taxonomyRepository.GetQueryableAsync())
                    .Where(x => sourceIds.Contains(x.Id))
                    .Select(x => new { x.Id, x.Name })))
                .ToDictionary(x => x.Id, x => x.Name);
        }
    }

    private static string PeriodLabel(ClinicReportQueryDto input) =>
        !input.FromDate.HasValue && !input.ToDate.HasValue
            ? "Toàn bộ thời gian"
            : $"Từ {input.FromDate:dd/MM/yyyy} đến {input.ToDate:dd/MM/yyyy}";

    private sealed record TicketFacts(
        TicketStatus Status,
        Guid? SourceId,
        TicketChannel Channel,
        bool IsReturningCustomer,
        Guid? AssigneeId,
        DateTime ReceivedAt,
        DateTime? DueAt);
}
