using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.CustomerCare.Messaging;
using BlueDental.PatientManagement;
using BlueDental.Tools;
using BlueDental.TreatmentManagement;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Linq;

namespace BlueDental.ZaloInbox;

/// <summary>
/// What Hộp thư Zalo shows of a conversation: the list row, the header and
/// side panel, and the chat with the linked record's ZNS woven in. Reads only
/// the conversation's own branch; the money waits for "Chi phí › Xem".
/// </summary>
public class ZaloInboxReader(
    IRepository<Patient, Guid> patients,
    IRepository<Appointment, Guid> appointments,
    IRepository<TreatmentPlan, Guid> plans,
    IRepository<PatientPayment, Guid> payments,
    IRepository<CatalogEntry, Guid> catalog,
    IRepository<ZaloChatMessage, Guid> messages,
    IRepository<MessageLog, Guid> messageLogs,
    IIdentityUserRepository users,
    PatientMoneyCalculator money,
    TreatmentCostAccess costAccess,
    IAsyncQueryableExecuter asyncExecuter) : ITransientDependency
{
    /// <summary>The chat shows this many latest messages; older ones stay stored.</summary>
    public const int MaxTimeline = 300;

    private static readonly AppointmentStatus[] Visited =
        [AppointmentStatus.CheckedIn, AppointmentStatus.InProgress, AppointmentStatus.Completed];

    private static readonly TreatmentServiceStatus[] Treating =
        [TreatmentServiceStatus.Created, TreatmentServiceStatus.InProgress];

    public async Task<List<ZaloConversationSummaryDto>> SummariesAsync(
        IReadOnlyList<ZaloConversation> conversations, DateTime now)
    {
        var records = await RecordsAsync(conversations);
        var names = await UserNamesAsync(conversations.Select(c => c.HolderAt(now)));
        return [.. conversations.Select(c => Fill(new ZaloConversationSummaryDto(), c, records, names, now))];
    }

    public async Task<ZaloConversationDetailDto> DetailAsync(ZaloConversation conversation, DateTime now)
    {
        var records = await RecordsAsync([conversation]);
        var names = await UserNamesAsync([conversation.HolderAt(now)]);
        var detail = Fill(new ZaloConversationDetailDto(), conversation, records, names, now);
        detail.ReplyWindowEndsAt = conversation.ReplyWindowEndsAt;
        detail.CanReplyFreely = conversation.CanReplyFreely(now);
        if (records.GetValueOrDefault(conversation.PatientId ?? Guid.Empty) is { } record)
        {
            detail.Customer = await PanelAsync(conversation.ClinicBranchId, record, now);
        }

        return detail;
    }

    /// <summary>
    /// Oldest first. A ZNS the chat history already carries (same Zalo message
    /// id) shows once, as the ZNS it is.
    /// </summary>
    public async Task<List<ZaloChatEntryDto>> TimelineAsync(ZaloConversation conversation)
    {
        var chat = await asyncExecuter.ToListAsync((await messages.GetQueryableAsync())
            .Where(m => m.ConversationId == conversation.Id)
            .OrderByDescending(m => m.SentAt)
            .Take(MaxTimeline));

        var zns = conversation.PatientId is { } patientId
            ? await asyncExecuter.ToListAsync((await messageLogs.GetQueryableAsync())
                .Where(l => l.ClinicBranchId == conversation.ClinicBranchId && l.PatientId == patientId)
                .Where(l => l.Channel == MessageChannelType.Zalo && l.Status != MessageSendStatus.Pending)
                .OrderByDescending(l => l.CreationTime)
                .Take(MaxTimeline))
            : [];
        var znsIds = zns.Select(l => l.ExternalMessageId).OfType<string>().ToHashSet();
        chat = [.. chat.Where(m => m.ZaloMessageId == null || !znsIds.Contains(m.ZaloMessageId))];

        var names = await UserNamesAsync(chat.Select(m => m.SenderUserId).Concat(zns.Select(l => l.CreatorId)));
        return [.. chat.Select(m => ToEntry(m, names))
            .Concat(zns.Select(l => ToEntry(l, names)))
            .OrderBy(e => e.SentAt)];
    }

    public static ZaloChatEntryDto ToEntry(ZaloChatMessage m, IReadOnlyDictionary<Guid, string> names) => new()
    {
        Key = "c-" + m.Id,
        Source = ZaloChatEntrySource.Chat,
        Direction = m.Direction,
        Kind = m.Kind,
        Text = m.Text,
        AttachmentUrl = m.AttachmentUrl,
        SentAt = m.SentAt,
        SenderName = m.SenderUserId is { } sender ? names.GetValueOrDefault(sender) : null,
    };

    public static ZaloChatEntryDto ToEntry(MessageLog l, IReadOnlyDictionary<Guid, string> names) => new()
    {
        Key = "z-" + l.Id,
        Source = ZaloChatEntrySource.Zns,
        Direction = ZaloChatDirection.Outbound,
        Kind = ZaloChatKind.Text,
        Text = l.Content,
        SentAt = l.SentAt ?? l.CreationTime,
        SenderName = l.CreatorId is { } creator ? names.GetValueOrDefault(creator) : null,
        TemplateName = l.TemplateName,
        ZnsState = StateOf(l.Status),
    };

    /// <summary>How far a logged message got, in the words the chat and the history use.</summary>
    public static ZaloZnsState StateOf(MessageSendStatus status) => status switch
    {
        MessageSendStatus.Delivered => ZaloZnsState.Delivered,
        MessageSendStatus.Failed => ZaloZnsState.Failed,
        _ => ZaloZnsState.Sent,
    };

    public async Task<Dictionary<Guid, string>> UserNamesAsync(IEnumerable<Guid?> ids)
    {
        var wanted = ids.OfType<Guid>().Distinct().ToList();
        if (wanted.Count == 0)
        {
            return [];
        }

        return (await users.GetListByIdsAsync(wanted)).ToDictionary(u => u.Id, FullName);
    }

    public static string FullName(IdentityUser user)
    {
        var full = string.Join(" ", new[] { user.Surname, user.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return string.IsNullOrWhiteSpace(full) ? user.UserName : full;
    }

    private static T Fill<T>(
        T dto, ZaloConversation c, IReadOnlyDictionary<Guid, Patient> records, IReadOnlyDictionary<Guid, string> names, DateTime now)
        where T : ZaloConversationSummaryDto
    {
        var record = c.PatientId is { } id ? records.GetValueOrDefault(id) : null;
        var holder = c.HolderAt(now);
        dto.Id = c.Id;
        dto.DisplayName = c.DisplayName;
        dto.AvatarUrl = c.AvatarUrl;
        dto.SharedPhone = c.SharedPhone;
        dto.PatientId = record?.Id;
        dto.PatientCode = record?.PatientCode;
        dto.PatientName = record?.FullName;
        dto.PatientPhone = record?.Contact?.PhoneNumber;
        dto.Status = c.Status;
        dto.LastMessageAt = c.LastMessageAt;
        dto.LastMessagePreview = c.LastMessagePreview;
        dto.LastMessageDirection = c.LastMessageDirection;
        dto.LastCustomerMessageAt = c.LastCustomerMessageAt;
        dto.HolderId = holder;
        dto.HolderName = holder is { } h ? names.GetValueOrDefault(h) : null;
        dto.HeldUntil = holder == null ? null : c.HeldUntil;
        dto.InfoRequestedAt = c.InfoRequestedAt;
        dto.Tags = [.. c.Tags];
        return dto;
    }

    /// <summary>Linked records of the conversations' own branch; a record moved elsewhere reads as none.</summary>
    private async Task<Dictionary<Guid, Patient>> RecordsAsync(IReadOnlyList<ZaloConversation> conversations)
    {
        var ids = conversations.Select(c => c.PatientId).OfType<Guid>().Distinct().ToList();
        if (ids.Count == 0)
        {
            return [];
        }

        var branches = conversations.Select(c => c.ClinicBranchId).Distinct().ToList();
        return (await patients.GetListAsync(p => ids.Contains(p.Id) && branches.Contains(p.BranchId)))
            .ToDictionary(p => p.Id);
    }

    private async Task<ZaloCustomerPanelDto> PanelAsync(Guid branchId, Patient record, DateTime now)
    {
        var visits = await asyncExecuter.ToListAsync((await appointments.GetQueryableAsync())
            .Where(a => a.BranchId == branchId && a.PatientId == record.Id && !a.IsTemporary));
        var next = visits
            .Where(a => MessageVariableResolver.Upcoming.Contains(a.Status) && a.Slot.Start >= now)
            .MinBy(a => a.Slot.Start);
        var last = visits
            .Where(a => Visited.Contains(a.Status) && a.Slot.Start <= now)
            .MaxBy(a => a.Slot.Start);

        // WithDetails: the slip's money and its treating lines read its service lines.
        var slips = (await plans.WithDetailsAsync(p => p.Services))
            .Where(p => p.BranchId == branchId && p.PatientId == record.Id && p.Status != TreatmentPlanStatus.Cancelled)
            .ToList();
        var treating = slips
            .Where(p => p.Status != TreatmentPlanStatus.Completed)
            .SelectMany(p => p.Services.Where(s => Treating.Contains(s.Status)).Select(s => (Plan: p, Line: s)))
            .ToList();
        var serviceIds = treating.Select(t => t.Line.ServiceId).Distinct().ToList();
        var serviceNames = serviceIds.Count == 0
            ? []
            : (await catalog.GetListAsync(c => serviceIds.Contains(c.Id))).ToDictionary(c => c.Id, c => c.Name);
        var dentistId = treating.Select(t => t.Line.DentistId ?? t.Plan.DentistId).FirstOrDefault();
        var dentist = (await UserNamesAsync([dentistId == Guid.Empty ? null : dentistId])).Values.FirstOrDefault();

        var panel = new ZaloCustomerPanelDto
        {
            PatientId = record.Id,
            Code = record.PatientCode,
            Name = record.FullName,
            Phone = record.Contact?.PhoneNumber,
            NextAppointmentAt = next?.Slot.Start.UtcDateTime,
            LastVisitAt = last?.Slot.Start.UtcDateTime,
            ActiveServices = [.. serviceIds.Select(id => serviceNames.GetValueOrDefault(id)).OfType<string>()],
            DentistName = dentist,
            SeesMoney = await costAccess.SeesCostsAsync(),
        };

        if (panel.SeesMoney)
        {
            var paid = await payments.GetListAsync(p => p.ClinicBranchId == branchId && p.PatientId == record.Id);
            var summary = money.ForPatient(slips, paid);
            panel.TotalAmount = summary.TotalPrice;
            panel.PaidAmount = summary.TotalPaid;
            panel.DueAmount = summary.TotalDue > 0m ? summary.TotalDue : 0m;
        }

        return panel;
    }
}
