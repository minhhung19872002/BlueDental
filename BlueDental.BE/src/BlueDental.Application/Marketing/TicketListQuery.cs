using System;
using System.Collections.Generic;
using System.Linq;

namespace BlueDental.Marketing;

/// <summary>
/// The list filters of Marketing → Ticket, shared by the page and the KPI
/// strip so the counts always describe the rows below them.
/// </summary>
internal static class TicketListQuery
{
    private static readonly TimeSpan ClinicUtcOffset = TimeSpan.FromHours(7);

    /// <summary>Everything but the status filter: the strip counts every status.</summary>
    public static IQueryable<Ticket> ApplyFilters(
        IQueryable<Ticket> query,
        GetTicketListInput input,
        IReadOnlyList<Guid> branchFilter,
        Guid? ownerScope,
        DateTime now)
    {
        if (branchFilter.Count > 0) query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        query = input.Deleted ? query.Where(x => x.IsDeleted) : query.Where(x => !x.IsDeleted);

        // Without readAll the caller sees their own tickets and the pool.
        if (ownerScope is { } me) query = query.Where(x => x.AssigneeId == me || x.AssigneeId == null);

        if (input.TagId is { } tagId) query = query.Where(x => x.TagIds.Contains(tagId));
        if (input.AssigneeId is { } assigneeId) query = query.Where(x => x.AssigneeId == assigneeId);
        if (input.Unassigned) query = query.Where(x => x.AssigneeId == null);
        if (input.SourceTaxonomyId is { } source) query = query.Where(x => x.SourceTaxonomyId == source);
        if (input.SourceEntryId is { } entry) query = query.Where(x => x.SourceEntryId == entry);
        if (input.Channel is { } channel) query = query.Where(x => x.Channel == channel);
        if (input.ReturningCustomer is { } returning) query = query.Where(x => x.IsReturningCustomer == returning);
        if (input.ImportFileId is { } fileId) query = query.Where(x => x.ImportFileId == fileId);

        if (input.FromDate is { } from)
        {
            var start = ClinicDayStartUtc(from);
            query = query.Where(x => x.ReceivedAt >= start);
        }

        if (input.ToDate is { } to)
        {
            var end = ClinicDayStartUtc(to.AddDays(1));
            query = query.Where(x => x.ReceivedAt < end);
        }

        if (input.OverdueOnly) query = WhereOverdue(query, now);
        if (input.CallBackDue) query = WhereCallBackDue(query, now);

        var term = input.Filter?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(term))
        {
            var digits = new string(term.Where(char.IsDigit).ToArray());
            query = query.Where(x => x.FullName.ToLower().Contains(term)
                || x.Code.ToLower().Contains(term)
                || (digits.Length >= 3 && x.Phone.Contains(digits)));
        }

        return query;
    }

    public static IQueryable<Ticket> WithStatuses(IQueryable<Ticket> query, IReadOnlyCollection<TicketStatus>? statuses) =>
        statuses is { Count: > 0 } ? query.Where(x => statuses.Contains(x.Status)) : query;

    public static IQueryable<Ticket> WhereOverdue(IQueryable<Ticket> query, DateTime now) =>
        query.Where(x => x.DueAt < now && (x.Status == TicketStatus.New || x.Status == TicketStatus.InCare));

    public static IQueryable<Ticket> WhereCallBackDue(IQueryable<Ticket> query, DateTime now) =>
        query.Where(x => x.NextCallAt <= now
            && (x.Status == TicketStatus.New || x.Status == TicketStatus.InCare || x.Status == TicketStatus.Booked));

    private static DateTime ClinicDayStartUtc(DateOnly day) =>
        new DateTimeOffset(day.ToDateTime(TimeOnly.MinValue), ClinicUtcOffset).UtcDateTime;
}
