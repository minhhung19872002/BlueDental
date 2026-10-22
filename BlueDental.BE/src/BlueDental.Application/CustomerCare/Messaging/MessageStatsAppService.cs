using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Tools;
using BlueDental.Zalo;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// Tổng quan ▸ Thống kê CSKH (BA P2110, F-78): the current branch's CSKH
/// messages over a period of clinic-local days.
///
/// A message counts on the day it went or was refused; one still waiting
/// counts nowhere but in "Người nhận" and "Lịch sử gửi", which list what was
/// made or set to go within the period.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.CskhStats.Read)]
public class MessageStatsAppService(
    IRepository<MessageLog, Guid> messages,
    IRepository<MessageSendBatch, Guid> batches,
    IRepository<MessageTemplate, Guid> templates,
    IIdentityUserRepository users,
    MessageBatchCounter counter,
    PatientPhoneMasker phoneMasker,
    BranchAccessChecker branchAccess,
    ICurrentClinicBranchResolver branchResolver) : BlueDentalAppService, IMessageStatsAppService
{
    /// <summary>A file holds this many recipients at most, newest first.</summary>
    private const int MaxExportRecipients = 50_000;

    public async Task<MessageStatsOverviewDto> GetOverviewAsync(MessageStatsOverviewInput input)
    {
        var branchId = await GetBranchIdAsync();
        var period = PeriodOf(input.FromDate, input.ToDate);
        var tried = await LoadTriedAsync(branchId, period, input);
        var names = await TemplateNamesAsync(tried.Select(t => t.TemplateId));

        MessageStatsTotalsDto? previous = null;
        if (input.CompareFromDate is { } compareFrom && input.CompareToDate is { } compareTo)
        {
            previous = TotalsOf(await LoadTriedAsync(branchId, PeriodOf(compareFrom, compareTo), input));
        }

        return new MessageStatsOverviewDto
        {
            Totals = TotalsOf(tried),
            Previous = previous,
            Days = DaysOf(period, tried),
            Channels = [.. Enum.GetValues<MessageChannelType>().Select(channel =>
            {
                var of = tried.Where(t => t.Channel == channel).ToList();
                return new MessageStatsChannelDto { Channel = channel, Sent = of.Count, Succeeded = of.Count(IsSucceeded) };
            })],
            Templates = TemplatesOf(tried, names),
        };
    }

    public async Task<List<MessageStatsTemplateOptionDto>> GetTemplateOptionsAsync()
    {
        var branchId = await GetBranchIdAsync();
        var used = (await messages.GetQueryableAsync())
            .Where(m => m.ClinicBranchId == branchId && m.TemplateId != null)
            .Select(m => m.TemplateId);

        List<MessageTemplate> found;
        using (DataFilter.Disable<ISoftDelete>())
        {
            found = await AsyncExecuter.ToListAsync((await templates.GetQueryableAsync())
                .Where(t => t.ClinicBranchId == branchId && (!t.IsDeleted || used.Contains((Guid?)t.Id))));
        }

        return [.. found
            .OrderBy(t => t.Channel)
            .ThenBy(t => t.IsDeleted)
            .ThenBy(t => t.Name, StringComparer.CurrentCultureIgnoreCase)
            .Select(t => new MessageStatsTemplateOptionDto
            {
                Id = t.Id,
                Name = t.IsDeleted ? L["CSKH:Stats:DeletedTemplate", t.Name].Value : t.Name,
                Channel = t.Channel,
            })];
    }

    public async Task<PagedResultDto<MessageStatsBatchDto>> GetBatchesAsync(MessageStatsPagedInput input)
    {
        var branchId = await GetBranchIdAsync();
        var query = await BatchQueryAsync(branchId, PeriodOf(input.FromDate, input.ToDate), input);
        var total = await AsyncExecuter.CountAsync(query);
        var page = await AsyncExecuter.ToListAsync(query.Skip(input.SkipCount).Take(input.MaxResultCount));
        return new PagedResultDto<MessageStatsBatchDto>(total, await ToBatchDtosAsync(page));
    }

    public async Task<PagedResultDto<MessageStatsRecipientDto>> GetRecipientsAsync(GetMessageStatsRecipientsInput input)
    {
        var branchId = await GetBranchIdAsync();
        var query = await RecipientQueryAsync(
            branchId, PeriodOf(input.FromDate, input.ToDate), input, input.Filter, input.Outcome);
        var total = await AsyncExecuter.CountAsync(query);
        var page = await AsyncExecuter.ToListAsync(Sort(query, input.Sorting)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount));

        // The API's response filter masks the phones for a "Ẩn số điện thoại" viewer.
        return new PagedResultDto<MessageStatsRecipientDto>(total, await ToRecipientDtosAsync(page));
    }

    [Authorize(BlueDentalAbilityPermissions.CskhStats.Export)]
    public async Task<byte[]> ExportAsync(MessageStatsExportInput input)
    {
        var branchId = await GetBranchIdAsync();
        var period = PeriodOf(input.FromDate, input.ToDate);
        var tried = await LoadTriedAsync(branchId, period, input);
        var names = await TemplateNamesAsync(tried.Select(t => t.TemplateId));
        var sends = await ToBatchDtosAsync(await AsyncExecuter.ToListAsync(await BatchQueryAsync(branchId, period, input)));
        var recipients = await ToRecipientDtosAsync(await AsyncExecuter.ToListAsync(
            Sort(await RecipientQueryAsync(branchId, period, input, input.Filter, input.Outcome), null)
                .Take(MaxExportRecipients)));

        // A file leaves the API without the response filter: mask it here (Cụm 11 mục 9).
        await phoneMasker.MaskIfRequiredAsync(recipients);

        return new MessageStatsExcel(L, period.From, period.To).Build(
            DaysOf(period, tried), TemplatesOf(tried, names), sends, recipients);
    }

    private async Task<Guid> GetBranchIdAsync()
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        await branchAccess.CheckAsync(branchId);
        return branchId;
    }

    /// <summary>No dates is the current month up to today; one date alone runs to today or from its month's first day.</summary>
    private StatsPeriod PeriodOf(DateOnly? from, DateOnly? to)
    {
        var today = ClinicCalendar.DateOf(new DateTimeOffset(DateTime.SpecifyKind(Clock.Now, DateTimeKind.Utc)));
        var end = to ?? (from is { } start && start > today ? start : today);
        var begin = from ?? new DateOnly(end.Year, end.Month, 1);
        if (end < begin)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.StatsPeriodReversed);
        }

        if (end.DayNumber - begin.DayNumber + 1 > MessageStatsLimits.MaxPeriodDays)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.StatsPeriodTooLong)
                .WithData("max", MessageStatsLimits.MaxPeriodDays);
        }

        return new StatsPeriod(begin, end);
    }

    /// <summary>
    /// Every message of the branch with the time it belongs to: when it went,
    /// else when its send started or is set to start, else when it was booked.
    /// </summary>
    private async Task<IQueryable<MessageFact>> FactsAsync(Guid branchId, MessageStatsFilterInput filter)
    {
        var logs = await messages.GetQueryableAsync();
        var sends = await batches.GetQueryableAsync();
        var query =
            from m in logs
            join b in sends on m.SendBatchId equals (Guid?)b.Id into joined
            from b in joined.DefaultIfEmpty()
            where m.ClinicBranchId == branchId
            select new MessageFact
            {
                Id = m.Id,
                PatientId = m.PatientId,
                Name = m.RecipientName,
                Phone = m.RecipientPhone,
                TemplateId = m.TemplateId,
                TemplateName = m.TemplateName,
                Channel = m.Channel,
                Status = m.Status,
                ErrorMessage = m.ErrorMessage,
                SendBatchId = m.SendBatchId,
                BatchStatus = b == null ? (MessageSendBatchStatus?)null : b.Status,
                ScheduledAt = b == null ? null : b.ScheduledAt,
                CreationTime = m.CreationTime,
                At = m.SentAt ?? (b == null ? null : b.StartedAt ?? b.ScheduledAt) ?? m.CreationTime,
            };

        if (filter.Channel is { } channel)
        {
            query = query.Where(f => f.Channel == channel);
        }

        if (filter.TemplateId is { } templateId)
        {
            query = query.Where(f => f.TemplateId == templateId);
        }

        return query;
    }

    /// <summary>The messages that went or were refused within the period — what the cards and charts count.</summary>
    private async Task<List<Tally>> LoadTriedAsync(Guid branchId, StatsPeriod period, MessageStatsFilterInput filter)
    {
        var (start, end) = (period.Start, period.End);
        return await AsyncExecuter.ToListAsync((await FactsAsync(branchId, filter))
            .Where(f => f.Status != MessageSendStatus.Pending && f.At >= start && f.At < end)
            .Select(f => new Tally(f.At, f.Channel, f.Status, f.TemplateId, f.TemplateName, f.SendBatchId)));
    }

    private async Task<IQueryable<MessageFact>> RecipientQueryAsync(
        Guid branchId, StatsPeriod period, MessageStatsFilterInput filter, string? search, MessageStatsOutcome? outcome)
    {
        var (start, end) = (period.Start, period.End);
        var query = (await FactsAsync(branchId, filter)).Where(f =>
            (f.At >= start && f.At < end) || (f.CreationTime >= start && f.CreationTime < end));

        query = outcome switch
        {
            MessageStatsOutcome.Succeeded => query.Where(f => MessageTemplateUsageReader.Delivered.Contains(f.Status)),
            MessageStatsOutcome.Failed => query.Where(f => f.Status == MessageSendStatus.Failed),
            MessageStatsOutcome.Pending => query.Where(f => f.Status == MessageSendStatus.Pending),
            _ => query,
        };

        var wholePhone = await phoneMasker.ShouldMaskAsync();
        foreach (var term in (search ?? string.Empty).Trim().ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            // Phones are kept as ZNS wants them (84…): "0903…" is looked up by what follows the 0.
            var local = term.Length > 1 && term[0] == '0' && term.All(char.IsDigit);
            var tail = local ? term[1..] : term;
            var whole = local ? "84" + tail : term;
            query = query.Where(f =>
                DbText.Unaccent(f.Name.ToLower()).Contains(DbText.Unaccent(term))
                || (wholePhone ? f.Phone == whole || f.Phone == term : f.Phone.Contains(tail)));
        }

        return query;
    }

    /// <summary>"Lịch sử gửi": sends made or set to go within the period, the latest time first.</summary>
    private async Task<IQueryable<MessageSendBatch>> BatchQueryAsync(
        Guid branchId, StatsPeriod period, MessageStatsFilterInput filter)
    {
        var (start, end) = (period.Start, period.End);
        var query = (await batches.GetQueryableAsync()).Where(b => b.ClinicBranchId == branchId
            && ((b.CreationTime >= start && b.CreationTime < end)
                || (b.ScheduledAt != null && b.ScheduledAt >= start && b.ScheduledAt < end)));

        if (filter.Channel is { } channel)
        {
            query = query.Where(b => b.Channel == channel);
        }

        if (filter.TemplateId is { } templateId)
        {
            query = query.Where(b => b.TemplateId == templateId);
        }

        return query.OrderByDescending(b => b.ScheduledAt ?? b.CreationTime).ThenByDescending(b => b.Id);
    }

    private static IQueryable<MessageFact> Sort(IQueryable<MessageFact> query, string? sorting)
    {
        var parts = (sorting ?? string.Empty).Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var byName = parts.FirstOrDefault() == "name";
        var ascending = parts.Length > 1 ? parts[1] == "asc" : byName;
        return (byName, ascending) switch
        {
            (true, true) => query.OrderBy(f => f.Name).ThenBy(f => f.Id),
            (true, false) => query.OrderByDescending(f => f.Name).ThenByDescending(f => f.Id),
            (false, true) => query.OrderBy(f => f.At).ThenBy(f => f.Id),
            _ => query.OrderByDescending(f => f.At).ThenByDescending(f => f.Id),
        };
    }

    private async Task<List<MessageStatsBatchDto>> ToBatchDtosAsync(List<MessageSendBatch> page)
    {
        var counts = await counter.CountAsync([.. page.Select(b => b.Id)]);
        var senders = await StaffNamesAsync(page.Select(b => b.CreatorId));
        return [.. page.Select(b =>
        {
            var of = counts.GetValueOrDefault(b.Id) ?? MessageBatchCounts.None;
            return new MessageStatsBatchDto
            {
                Id = b.Id,
                At = b.ScheduledAt ?? b.CreationTime,
                Channel = b.Channel,
                TemplateId = b.TemplateId,
                TemplateName = b.TemplateName,
                Source = b.Source,
                CareType = b.CareType,
                FromDate = b.FromDate,
                ToDate = b.ToDate,
                SenderName = b.CreatorId is { } creator ? senders.GetValueOrDefault(creator) : null,
                RecipientCount = b.RecipientCount,
                SentCount = of.Sent,
                FailedCount = of.Failed,
                PendingCount = of.Pending,
                Status = b.Status,
                ScheduledAt = b.ScheduledAt,
            };
        })];
    }

    private async Task<List<MessageStatsRecipientDto>> ToRecipientDtosAsync(List<MessageFact> page)
    {
        var names = await TemplateNamesAsync(page.Select(f => f.TemplateId));
        return [.. page.Select(f => new MessageStatsRecipientDto
        {
            Id = f.Id,
            PatientId = f.PatientId,
            Name = f.Name,
            Phone = string.IsNullOrWhiteSpace(f.Phone) ? null : ZaloPhoneNumber.ToLocal(f.Phone),
            TemplateName = NameOf(f.TemplateId, f.TemplateName, names),
            Channel = f.Channel,
            At = f.At,
            Outcome = f.Status switch
            {
                MessageSendStatus.Failed => MessageStatsOutcome.Failed,
                MessageSendStatus.Pending => MessageStatsOutcome.Pending,
                _ => MessageStatsOutcome.Succeeded,
            },
            Error = f.Status == MessageSendStatus.Failed ? MessageFailureReasons.Describe(f.ErrorMessage, L) : null,
            Scheduled = f is { Status: MessageSendStatus.Pending, BatchStatus: MessageSendBatchStatus.Queued, ScheduledAt: not null },
        })];
    }

    private static MessageStatsTotalsDto TotalsOf(IReadOnlyCollection<Tally> tried) => new()
    {
        Sent = tried.Count,
        Succeeded = tried.Count(IsSucceeded),
        Failed = tried.Count(t => t.Status == MessageSendStatus.Failed),
    };

    private static List<MessageStatsDayDto> DaysOf(StatsPeriod period, IReadOnlyCollection<Tally> tried)
    {
        var byDay = tried.ToLookup(t => DayOf(t.At));
        return [.. Enumerable.Range(0, period.To.DayNumber - period.From.DayNumber + 1).Select(offset =>
        {
            var day = period.From.AddDays(offset);
            var of = byDay[day].ToList();
            return new MessageStatsDayDto
            {
                Date = day,
                Sent = of.Count,
                Succeeded = of.Count(IsSucceeded),
                Failed = of.Count(t => t.Status == MessageSendStatus.Failed),
            };
        })];
    }

    /// <summary>A template is one row per channel; a message that named none is grouped by the name it carried.</summary>
    private List<MessageStatsTemplateDto> TemplatesOf(
        IReadOnlyCollection<Tally> tried, IReadOnlyDictionary<Guid, string> names) =>
        [.. tried
            .GroupBy(t => (t.TemplateId, Name: t.TemplateId == null ? t.TemplateName : null, t.Channel))
            .Select(g => new MessageStatsTemplateDto
            {
                TemplateId = g.Key.TemplateId,
                Name = NameOf(g.Key.TemplateId, g.Key.Name, names) ?? L["CSKH:Stats:UnknownTemplate"].Value,
                Channel = g.Key.Channel,
                Uses = g.Where(t => t.SendBatchId != null).Select(t => t.SendBatchId).Distinct().Count()
                    + g.Count(t => t.SendBatchId == null),
                Sent = g.Count(),
                Succeeded = g.Count(IsSucceeded),
                LastSentAt = g.Max(t => t.At),
            })
            .OrderByDescending(r => r.Sent)
            .ThenBy(r => r.Name, StringComparer.CurrentCultureIgnoreCase)];

    /// <summary>Templates by their current name — a deleted one says so — whether or not they are deleted.</summary>
    private async Task<Dictionary<Guid, string>> TemplateNamesAsync(IEnumerable<Guid?> ids)
    {
        var wanted = ids.OfType<Guid>().Distinct().ToList();
        if (wanted.Count == 0)
        {
            return [];
        }

        using (DataFilter.Disable<ISoftDelete>())
        {
            var found = await AsyncExecuter.ToListAsync((await templates.GetQueryableAsync())
                .Where(t => wanted.Contains(t.Id))
                .Select(t => new { t.Id, t.Name, t.IsDeleted }));
            return found.ToDictionary(t => t.Id, t => t.IsDeleted ? L["CSKH:Stats:DeletedTemplate", t.Name].Value : t.Name);
        }
    }

    private static string? NameOf(Guid? templateId, string? logged, IReadOnlyDictionary<Guid, string> names) =>
        templateId is { } id && names.TryGetValue(id, out var name) ? name : logged;

    private async Task<Dictionary<Guid, string>> StaffNamesAsync(IEnumerable<Guid?> ids)
    {
        var userIds = ids.OfType<Guid>().Distinct().ToList();
        if (userIds.Count == 0)
        {
            return [];
        }

        // Staff removed since still name the sends they made.
        List<IdentityUser> found;
        using (DataFilter.Disable<ISoftDelete>())
        {
            found = await users.GetListByIdsAsync(userIds);
        }

        return found.ToDictionary(u => u.Id, u =>
        {
            var fullName = string.Join(" ", new[] { u.Surname, u.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
            return string.IsNullOrWhiteSpace(fullName) ? u.UserName : fullName;
        });
    }

    private static bool IsSucceeded(Tally t) => MessageTemplateUsageReader.Delivered.Contains(t.Status);

    private static DateOnly DayOf(DateTime at) =>
        ClinicCalendar.DateOf(new DateTimeOffset(DateTime.SpecifyKind(at, DateTimeKind.Utc)));

    /// <summary>One message as the statistics read it; see <see cref="FactsAsync"/>.</summary>
    private sealed class MessageFact
    {
        public Guid Id { get; init; }
        public Guid? PatientId { get; init; }
        public string Name { get; init; } = string.Empty;
        public string Phone { get; init; } = string.Empty;
        public Guid? TemplateId { get; init; }
        public string? TemplateName { get; init; }
        public MessageChannelType Channel { get; init; }
        public MessageSendStatus Status { get; init; }
        public string? ErrorMessage { get; init; }
        public Guid? SendBatchId { get; init; }
        public MessageSendBatchStatus? BatchStatus { get; init; }
        public DateTime? ScheduledAt { get; init; }
        public DateTime CreationTime { get; init; }
        public DateTime At { get; init; }
    }

    private sealed record Tally(
        DateTime At, MessageChannelType Channel, MessageSendStatus Status, Guid? TemplateId, string? TemplateName, Guid? SendBatchId);
}

/// <summary>Clinic-local days <see cref="From"/>..<see cref="To"/>, both included, as a half-open UTC window.</summary>
internal sealed record StatsPeriod(DateOnly From, DateOnly To)
{
    public DateTime Start => ClinicCalendar.StartOfDay(From).UtcDateTime;
    public DateTime End => ClinicCalendar.StartOfDay(To.AddDays(1)).UtcDateTime;
}
