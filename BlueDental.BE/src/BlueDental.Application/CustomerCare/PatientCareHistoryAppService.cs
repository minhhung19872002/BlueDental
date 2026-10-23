using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Marketing;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Tools;
using BlueDental.ZaloInbox;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.CustomerCare;

/// <summary>
/// "Lịch sử chăm sóc khách hàng" on the record's Chăm sóc KH tab (BA P2210):
/// every way the branch has looked after the customer, newest first — the
/// Zalo OA chat, ZNS / SMS / e-mail, calls to their phone, care notes (the
/// chat's too) and CSKH tasks changing state — with the 90-day contact state
/// and what this year's care cost.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.TreatmentCskh.Read)]
public class PatientCareHistoryAppService(
    IRepository<Patient, Guid> patients,
    IRepository<ZaloConversation, Guid> conversations,
    IRepository<ZaloChatMessage, Guid> chatMessages,
    IRepository<MessageLog, Guid> messageLogs,
    IRepository<CallLog, Guid> callLogs,
    IRepository<CareRecord, Guid> careRecords,
    IRepository<CareContactLog, Guid> contactLogs,
    CareNoteReader notes,
    ZaloInboxReader names,
    BranchAccessChecker branchAccess,
    ICurrentClinicBranchResolver branchResolver) : BlueDentalAppService, IPatientCareHistoryAppService
{
    /// <summary>BA P2210: "Trong vòng 90 ngày mà không có phát sinh bất kỳ tin nhắn CSKH → chưa liên hệ".</summary>
    public const int ContactWindowDays = 90;

    /// <summary>Each source reads at most this many lines; the period filter reaches further back.</summary>
    public const int MaxPerSource = 300;

    private static readonly MessageSendStatus[] Reached = [MessageSendStatus.Sent, MessageSendStatus.Delivered];

    /// <summary>A line still waiting for its staff member's name.</summary>
    private sealed record Line(CareHistoryEntryDto Entry, Guid? ActorId);

    public async Task<List<CareHistoryEntryDto>> GetListAsync(Guid patientId, GetPatientCareHistoryInput input)
    {
        var (branchId, patient) = await GetPatientAsync(patientId);
        var from = input.FromDate?.UtcDateTime ?? DateTime.MinValue;
        var to = input.ToDate?.UtcDateTime ?? DateTime.MaxValue;
        if (from > to)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.StatsPeriodReversed);
        }

        var chats = await LinkedConversationIdsAsync(branchId, patientId);
        bool Wants(CareHistoryFilter kind) => input.Kind == CareHistoryFilter.All || input.Kind == kind;

        var lines = new List<Line>();
        var logs = Wants(CareHistoryFilter.Message) || Wants(CareHistoryFilter.ZaloChat)
            ? await MessagesAsync(branchId, patientId, from, to)
            : [];
        if (Wants(CareHistoryFilter.Message))
        {
            lines.AddRange(logs.Select(ToLine));
        }

        if (Wants(CareHistoryFilter.ZaloChat))
        {
            lines.AddRange(await ChatAsync(chats, logs, from, to));
        }

        if (input.Kind == CareHistoryFilter.All)
        {
            lines.AddRange(await StatusChangesAsync(branchId, patientId, from, to));
        }

        var lookup = await names.UserNamesAsync(lines.Select(l => l.ActorId));
        var entries = lines.Select(l =>
        {
            l.Entry.ActorName = l.ActorId is { } id ? lookup.GetValueOrDefault(id) : null;
            return l.Entry;
        }).ToList();

        if (Wants(CareHistoryFilter.Call))
        {
            entries.AddRange(await CallsAsync(branchId, patient, from, to));
        }

        if (Wants(CareHistoryFilter.Note))
        {
            var list = await notes.ListAsync(branchId, CareNoteReader.OfPatient(patientId, chats));
            entries.AddRange(list.Where(n => n.CreatedAt >= from && n.CreatedAt <= to).Select(n => new CareHistoryEntryDto
            {
                Key = "n-" + n.Id,
                Kind = CareHistoryKind.Note,
                At = n.CreatedAt,
                Text = n.Content,
                ActorName = n.AuthorName,
                Note = n,
            }));
        }

        return [.. entries.OrderByDescending(e => e.At)];
    }

    public async Task<PatientCareOverviewDto> GetOverviewAsync(Guid patientId)
    {
        var (branchId, patient) = await GetPatientAsync(patientId);
        var now = Clock.Now;
        var chats = await LinkedConversationIdsAsync(branchId, patientId);

        var lastMessage = await AsyncExecuter.FirstOrDefaultAsync((await messageLogs.GetQueryableAsync())
            .Where(l => l.ClinicBranchId == branchId && l.PatientId == patientId && Reached.Contains(l.Status))
            .Select(l => (DateTime?)(l.SentAt ?? l.CreationTime))
            .OrderByDescending(at => at));
        var lastReply = chats.Count == 0
            ? null
            : await AsyncExecuter.FirstOrDefaultAsync((await chatMessages.GetQueryableAsync())
                .Where(m => chats.Contains(m.ConversationId) && m.Direction == ZaloChatDirection.Outbound)
                .Select(m => (DateTime?)m.SentAt)
                .OrderByDescending(at => at));
        var lastContact = new[] { lastMessage, lastReply }.Max();

        var conversation = await AsyncExecuter.FirstOrDefaultAsync((await conversations.GetQueryableAsync())
            .Where(c => c.ClinicBranchId == branchId && c.PatientId == patientId)
            .OrderByDescending(c => c.LastMessageAt));

        return new PatientCareOverviewDto
        {
            ContactState = lastContact >= now.AddDays(-ContactWindowDays)
                ? PatientContactState.Contacted
                : PatientContactState.NotContacted,
            ContactWindowDays = ContactWindowDays,
            LastContactAt = lastContact,
            ConversationId = conversation?.Id,
            ZaloStatus = conversation?.LastMessageAt == null ? null : conversation.Status,
            Year = await YearAsync(branchId, patient, chats, now),
        };
    }

    /// <summary>This calendar year, clinic time: messages that reached or failed, chat messages, calls, provider cost.</summary>
    private async Task<PatientCareCostSummaryDto> YearAsync(Guid branchId, Patient patient, List<Guid> chats, DateTime now)
    {
        var year = ClinicCalendar.ToLocal(now).Year;
        var from = ClinicCalendar.StartOfDay(new DateOnly(year, 1, 1)).UtcDateTime;
        var to = ClinicCalendar.StartOfDay(new DateOnly(year + 1, 1, 1)).UtcDateTime;

        var logs = await AsyncExecuter.ToListAsync((await messageLogs.GetQueryableAsync())
            .Where(l => l.ClinicBranchId == branchId && l.PatientId == patient.Id && l.Status != MessageSendStatus.Pending)
            .Where(l => (l.SentAt ?? l.CreationTime) >= from && (l.SentAt ?? l.CreationTime) < to)
            .Select(l => new { l.Channel, l.Status, l.Cost }));
        var phones = PhoneVariants(patient);
        return new PatientCareCostSummaryDto
        {
            Year = year,
            ZnsSent = logs.Count(l => l.Channel == MessageChannelType.Zalo && Reached.Contains(l.Status)),
            ZnsFailed = logs.Count(l => l.Channel == MessageChannelType.Zalo && l.Status == MessageSendStatus.Failed),
            SmsSent = logs.Count(l => l.Channel == MessageChannelType.Sms && Reached.Contains(l.Status)),
            ZaloChatMessages = chats.Count == 0 ? 0 : await AsyncExecuter.CountAsync((await chatMessages.GetQueryableAsync())
                .Where(m => chats.Contains(m.ConversationId) && m.SentAt >= from && m.SentAt < to)),
            Calls = phones.Count == 0 ? 0 : await AsyncExecuter.CountAsync((await callLogs.GetQueryableAsync())
                .Where(c => c.ClinicBranchId == branchId && phones.Contains(c.PhoneNumber) && c.CalledAt >= from && c.CalledAt < to)),
            MessageCost = logs.Where(l => Reached.Contains(l.Status)).Sum(l => l.Cost ?? 0m),
        };
    }

    private async Task<List<MessageLog>> MessagesAsync(Guid branchId, Guid patientId, DateTime from, DateTime to) =>
        await AsyncExecuter.ToListAsync((await messageLogs.GetQueryableAsync())
            .Where(l => l.ClinicBranchId == branchId && l.PatientId == patientId && l.Status != MessageSendStatus.Pending)
            .Where(l => (l.SentAt ?? l.CreationTime) >= from && (l.SentAt ?? l.CreationTime) <= to)
            .OrderByDescending(l => l.CreationTime)
            .Take(MaxPerSource));

    private static Line ToLine(MessageLog l) => new(new CareHistoryEntryDto
    {
        Key = "m-" + l.Id,
        Kind = CareHistoryKind.Message,
        At = l.SentAt ?? l.CreationTime,
        Text = l.Content,
        Channel = l.Channel,
        TemplateName = l.TemplateName,
        MessageState = ZaloInboxReader.StateOf(l.Status),
    }, l.CreatorId);

    /// <summary>A ZNS the chat history also carries shows once, as the message it is.</summary>
    private async Task<IEnumerable<Line>> ChatAsync(List<Guid> chats, List<MessageLog> logs, DateTime from, DateTime to)
    {
        if (chats.Count == 0)
        {
            return [];
        }

        var known = logs.Select(l => l.ExternalMessageId).OfType<string>().ToHashSet();
        var rows = await AsyncExecuter.ToListAsync((await chatMessages.GetQueryableAsync())
            .Where(m => chats.Contains(m.ConversationId) && m.SentAt >= from && m.SentAt <= to)
            .OrderByDescending(m => m.SentAt)
            .Take(MaxPerSource));
        return rows
            .Where(m => m.ZaloMessageId == null || !known.Contains(m.ZaloMessageId))
            .Select(m => new Line(new CareHistoryEntryDto
            {
                Key = "c-" + m.Id,
                Kind = CareHistoryKind.ZaloChat,
                At = m.SentAt,
                Text = m.Preview,
                Direction = m.Direction,
            }, m.SenderUserId));
    }

    /// <summary>Công cụ › Gọi thoại keeps the number, not the record: a call is the customer's when it went to their phone.</summary>
    private async Task<IEnumerable<CareHistoryEntryDto>> CallsAsync(Guid branchId, Patient patient, DateTime from, DateTime to)
    {
        var phones = PhoneVariants(patient);
        if (phones.Count == 0)
        {
            return [];
        }

        var rows = await AsyncExecuter.ToListAsync((await callLogs.GetQueryableAsync())
            .Where(c => c.ClinicBranchId == branchId && phones.Contains(c.PhoneNumber) && c.CalledAt >= from && c.CalledAt <= to)
            .OrderByDescending(c => c.CalledAt)
            .Take(MaxPerSource));
        return rows.Select(c => new CareHistoryEntryDto
        {
            Key = "k-" + c.Id,
            Kind = CareHistoryKind.Call,
            At = c.CalledAt,
            CallStatus = (int)c.Status,
            ActorName = c.StaffName,
        });
    }

    /// <summary>Lịch sử liên hệ of the record's CSKH tasks: the "Trạng thái → …" lines.</summary>
    private async Task<IEnumerable<Line>> StatusChangesAsync(Guid branchId, Guid patientId, DateTime from, DateTime to)
    {
        var types = (await AsyncExecuter.ToListAsync((await careRecords.GetQueryableAsync())
                .Where(r => r.BranchId == branchId && r.PatientId == patientId)
                .Select(r => new { r.Id, r.Type })))
            .ToDictionary(r => r.Id, r => r.Type);
        if (types.Count == 0)
        {
            return [];
        }

        var ids = types.Keys.ToList();
        var rows = await AsyncExecuter.ToListAsync((await contactLogs.GetQueryableAsync())
            .Where(l => ids.Contains(l.CareRecordId) && l.CreationTime >= from && l.CreationTime <= to)
            .OrderByDescending(l => l.CreationTime)
            .Take(MaxPerSource));
        return rows.Select(l => new Line(new CareHistoryEntryDto
        {
            Key = "s-" + l.Id,
            Kind = CareHistoryKind.Status,
            At = l.CreationTime,
            Text = l.Note,
            CareStatus = l.Status,
            CareType = types.GetValueOrDefault(l.CareRecordId),
        }, l.CreatorId));
    }

    /// <summary>The record's phone in every spelling a call log may hold it.</summary>
    private static List<string> PhoneVariants(Patient patient)
    {
        var raw = patient.Contact?.PhoneNumber?.Trim();
        if (string.IsNullOrEmpty(raw))
        {
            return [];
        }

        try
        {
            return [.. TicketPhone.Variants(TicketPhone.Normalize(raw)).Append(raw).Distinct()];
        }
        catch (BusinessException)
        {
            return [raw];
        }
    }

    private async Task<List<Guid>> LinkedConversationIdsAsync(Guid branchId, Guid patientId) =>
        await AsyncExecuter.ToListAsync((await conversations.GetQueryableAsync())
            .Where(c => c.ClinicBranchId == branchId && c.PatientId == patientId)
            .Select(c => c.Id));

    private async Task<(Guid BranchId, Patient Patient)> GetPatientAsync(Guid patientId)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        await branchAccess.CheckAsync(branchId);
        var patient = await patients.FirstOrDefaultAsync(p => p.Id == patientId && p.BranchId == branchId)
            ?? throw new EntityNotFoundException(typeof(Patient), patientId);
        return (branchId, patient);
    }
}
