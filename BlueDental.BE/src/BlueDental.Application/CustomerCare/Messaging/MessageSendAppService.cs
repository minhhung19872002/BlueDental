using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Tools;
using BlueDental.Zalo;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.BackgroundJobs;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Uow;
using Volo.Abp.Users;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// CSKH ▸ Gửi tin nhắn (BA P2110, F-77). Everything is the current branch's:
/// its templates, its CSKH lists and customers, its Zalo OA. "Gửi" books one
/// Pending message per customer and leaves the sending to <see cref="MessageSendJob"/>.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.CskhSend.Read)]
public class MessageSendAppService : BlueDentalAppService, IMessageSendAppService
{
    /// <summary>"Gần đây" under the form: the latest sends of the branch.</summary>
    private const int MaxBatchesListed = 50;

    private static readonly MessageTemplateStatus[] Offered =
        [MessageTemplateStatus.Ready, MessageTemplateStatus.PendingApproval, MessageTemplateStatus.Draft];

    private static readonly MessageChannelType[] Channels =
        [MessageChannelType.Zalo, MessageChannelType.Sms, MessageChannelType.Email];

    private readonly IRepository<MessageTemplate, Guid> _templates;
    private readonly IRepository<MessageSendBatch, Guid> _batches;
    private readonly IRepository<MessageLog, Guid> _messages;
    private readonly IRepository<CareRecord, Guid> _careRecords;
    private readonly IRepository<Patient, Guid> _patients;
    private readonly IRepository<Appointment, Guid> _appointments;
    private readonly IIdentityUserRepository _users;
    private readonly CareRecordWindow _window;
    private readonly MessageRecipientBuilder _recipients;
    private readonly MessageVariableResolver _variables;
    private readonly MessageTemplateUsageReader _usage;
    private readonly MessageValueMasker _masker;
    private readonly PatientPhoneMasker _phoneMasker;
    private readonly ZaloOaGateway _zalo;
    private readonly IZaloApiClient _zaloApi;
    private readonly IBackgroundJobManager _jobs;
    private readonly BranchAccessChecker _branchAccess;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public MessageSendAppService(
        IRepository<MessageTemplate, Guid> templates,
        IRepository<MessageSendBatch, Guid> batches,
        IRepository<MessageLog, Guid> messages,
        IRepository<CareRecord, Guid> careRecords,
        IRepository<Patient, Guid> patients,
        IRepository<Appointment, Guid> appointments,
        IIdentityUserRepository users,
        CareRecordWindow window,
        MessageRecipientBuilder recipients,
        MessageVariableResolver variables,
        MessageTemplateUsageReader usage,
        MessageValueMasker masker,
        PatientPhoneMasker phoneMasker,
        ZaloOaGateway zalo,
        IZaloApiClient zaloApi,
        IBackgroundJobManager jobs,
        BranchAccessChecker branchAccess,
        ICurrentClinicBranchResolver branchResolver)
    {
        _templates = templates;
        _batches = batches;
        _messages = messages;
        _careRecords = careRecords;
        _patients = patients;
        _appointments = appointments;
        _users = users;
        _window = window;
        _recipients = recipients;
        _variables = variables;
        _usage = usage;
        _masker = masker;
        _phoneMasker = phoneMasker;
        _zalo = zalo;
        _zaloApi = zaloApi;
        _jobs = jobs;
        _branchAccess = branchAccess;
        _branchResolver = branchResolver;
    }

    /// <summary>
    /// A Zalo "Sẵn sàng" of the older Công cụ screen has no ZNS link and could
    /// never go, so it is not offered; Chờ duyệt and Nháp are, to say why they wait.
    /// </summary>
    public async Task<MessageSendTemplatesDto> GetTemplatesAsync()
    {
        var branchId = await GetBranchIdAsync();
        var templates = (await _templates.GetListAsync(t =>
                t.ClinicBranchId == branchId && t.IsActive && Offered.Contains(t.Status)))
            .Where(t => t.Status != MessageTemplateStatus.Ready || t.CanSend)
            .OrderBy(t => t.Channel)
            .ThenBy(t => Array.IndexOf(MessageTemplateAppService.StatusOrder, t.Status))
            .ThenBy(t => t.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
        var usage = await _usage.LoadAsync(branchId, [.. templates.Select(t => t.Id)]);
        var zaloReady = (await _zalo.FindConnectionAsync(branchId))?.CanSend == true;

        return new MessageSendTemplatesDto
        {
            Items = [.. templates.Select(t => MessageTemplateAppService.ToDto(t, usage.GetValueOrDefault(t.Id)))],
            Channels = [.. Channels.Select(c => new MessageSendChannelDto
            {
                Channel = c,
                Connected = c == MessageChannelType.Zalo && zaloReady,
                ReadyCount = templates.Count(t => t.Channel == c && t.CanSend),
            })],
        };
    }

    /// <summary>A customer counts once per tab, as the "Gửi tới" table lists them.</summary>
    public async Task<List<MessageSendListDto>> GetListsAsync(GetMessageSendListsInput input)
    {
        var branchId = await GetBranchIdAsync();
        var lists = new List<MessageSendListDto>();
        foreach (var type in CareBoard.Types)
        {
            var query = (await _careRecords.GetQueryableAsync()).Where(r => r.BranchId == branchId && r.Type == type);
            var windowed = await _window.ApplyAsync(query, type, [branchId], input.FromDate, input.ToDate);
            var count = await AsyncExecuter.CountAsync(windowed.Records
                .Select(r => r.PatientId == Guid.Empty ? r.AppointmentId : (Guid?)r.PatientId)
                .Distinct());
            lists.Add(new MessageSendListDto { Type = type, Count = count });
        }

        return lists;
    }

    public async Task<MessageRecipientListDto> GetRecipientsAsync(MessageRecipientsInput input)
    {
        var branchId = await GetBranchIdAsync();
        var template = input.TemplateId is { } templateId ? await GetTemplateAsync(branchId, templateId) : null;
        if (template != null && template.Channel != input.Channel)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendTemplateNotReady);
        }

        var zns = await TryReadZnsAsync(branchId, template);
        var rows = await _recipients.BuildAsync(branchId, input, template, zns?.Params);
        return new MessageRecipientListDto
        {
            Items = [.. rows.Select(ToRecipientDto)],
            PricePerMessage = zns?.Price,
        };
    }

    public async Task<MessagePreviewDto> PreviewAsync(PreviewMessageSendInput input)
    {
        var branchId = await GetBranchIdAsync();
        var template = await GetTemplateAsync(branchId, input.TemplateId);
        var (values, isSample) = await ResolveValuesAsync(branchId, input.PatientId, input.AppointmentId);
        return MessageTemplateAppService.ToPreviewDto(
            template.Channel, MessageComposer.Compose(template, values), isSample);
    }

    public async Task<List<MessageSendCustomerDto>> FindCustomersAsync(FindMessageSendCustomersInput input)
    {
        var branchId = await GetBranchIdAsync();
        var terms = (input.Filter ?? string.Empty).Trim().ToLower()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var wholePhone = await _phoneMasker.ShouldMaskAsync();

        var query = (await _patients.GetQueryableAsync()).Where(p => p.BranchId == branchId);
        foreach (var term in terms)
        {
            query = query.Where(p =>
                DbText.Unaccent((p.LastName + " " + p.FirstName).ToLower()).Contains(DbText.Unaccent(term))
                || p.PatientCode.ToLower().Contains(term)
                || (p.Contact.PhoneNumber != null
                    && (wholePhone ? p.Contact.PhoneNumber == term : p.Contact.PhoneNumber.Contains(term))));
        }

        var found = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(p => p.CreationTime)
            .Take(MessageSendLimits.MaxCustomerResults));
        return [.. found.Select(p => new MessageSendCustomerDto
        {
            PatientId = p.Id,
            Name = p.FullName,
            Code = p.PatientCode,
            Phone = p.Contact.PhoneNumber,
        })];
    }

    /// <summary>
    /// Customers are read again here, not taken from the table on screen, so
    /// what goes is what the server sees now. Those left out are counted, not booked.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.CskhSend.Create)]
    public async Task<MessageSendBatchDto> CreateAsync(CreateMessageSendInput input)
    {
        var branchId = await GetBranchIdAsync();
        var template = input.TemplateId is { } templateId
            ? await GetTemplateAsync(branchId, templateId)
            : throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendTemplateNotReady);
        var connection = await GetSendingConnectionAsync(branchId, input.Channel);
        if (template.Channel != input.Channel || !template.CanSend)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendTemplateNotReady);
        }

        var detail = await _zalo.FetchTemplateDetailAsync(branchId, connection, template.ExternalTemplateId!);
        var rows = await _recipients.BuildAsync(branchId, input, template, detail.Params);
        var going = rows.Where(r => r.SkipReason == null).ToList();

        var batchId = GuidGenerator.Create();
        var scheduledAt = input.ScheduledAt?.UtcDateTime;
        var batch = MessageSendBatch.Create(
            batchId, branchId, template,
            new MessageSendRecipients(
                input.Source, input.CareType, input.FromDate?.UtcDateTime, input.ToDate?.UtcDateTime,
                going.Count, rows.Count - going.Count),
            input.SkipRecentDuplicates, scheduledAt, Clock.Now);

        await _batches.InsertAsync(batch);
        await _messages.InsertManyAsync(going.Select(r => new MessageLog(
                GuidGenerator.Create(), branchId, r.PatientId, template.Id,
                r.Name, MessageRecipientBuilder.NormalizePhone(r.Phone)!,
                r.Check!.Message.Text, template.Channel, MessageSendStatus.Pending, null, null)
            .SetExternalTemplate(template.ExternalTemplateId, template.Name)
            .ForBatch(batchId, r.CareRecordId)));
        await CurrentUnitOfWork!.SaveChangesAsync();

        var delay = scheduledAt - Clock.Now;
        await _jobs.EnqueueAsync(
            new MessageSendJobArgs { BatchId = batchId },
            delay: delay > TimeSpan.Zero ? delay : null);

        return ToBatchDto(batch, new BatchCounts(0, 0, going.Count));
    }

    public async Task<MessageSendBatchDto> GetAsync(Guid id)
    {
        var batch = await GetBatchAsync(id);
        var counts = await CountAsync([batch.Id]);
        return ToBatchDto(batch, counts.GetValueOrDefault(batch.Id) ?? BatchCounts.None);
    }

    public async Task<List<MessageSendBatchDto>> GetListAsync(GetMessageSendBatchListInput input)
    {
        var branchId = await GetBranchIdAsync();
        var query = (await _batches.GetQueryableAsync())
            .Where(b => b.ClinicBranchId == branchId)
            .Where(b => input.Status == null || b.Status == input.Status);
        var batches = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(b => b.CreationTime)
            .Take(MaxBatchesListed));
        var counts = await CountAsync([.. batches.Select(b => b.Id)]);
        return [.. batches.Select(b => ToBatchDto(b, counts.GetValueOrDefault(b.Id) ?? BatchCounts.None))];
    }

    /// <summary>The booked messages go with the batch: none of them was sent, so nothing of them is history.</summary>
    [Authorize(BlueDentalAbilityPermissions.CskhSend.Create)]
    public async Task<MessageSendBatchDto> CancelAsync(Guid id)
    {
        var batch = await GetBatchAsync(id);
        batch.Cancel(Clock.Now);
        await _batches.UpdateAsync(batch);
        await _messages.DeleteAsync(m => m.SendBatchId == id && m.Status == MessageSendStatus.Pending);
        return ToBatchDto(batch, BatchCounts.None);
    }

    /// <summary>
    /// Filled with the customer on preview, as the viewer is allowed to see
    /// them. Leaves no message row, so "đã gửi" of the template stays the
    /// customers', and only the integration call log keeps the call.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.CskhSend.Create)]
    public async Task<MessageTestSendDto> SendTestAsync(SendTestMessageInput input)
    {
        var branchId = await GetBranchIdAsync();
        var user = await _users.GetAsync(CurrentUser.GetId());
        var phone = MessageRecipientBuilder.NormalizePhone(user.PhoneNumber)
            ?? throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendNoTestPhone);

        var template = await GetTemplateAsync(branchId, input.TemplateId);
        var connection = await GetSendingConnectionAsync(branchId, template.Channel);
        if (!template.CanSend)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendTemplateNotReady);
        }

        var detail = await _zalo.FetchTemplateDetailAsync(branchId, connection, template.ExternalTemplateId!);
        var (values, _) = await ResolveValuesAsync(branchId, input.PatientId, input.AppointmentId);
        var check = MessageRecipientBuilder.Check(template, detail.Params, values);
        if (check.Missing.Count > 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.ZaloTemplateDataMissing)
                .WithData("params", string.Join(", ", check.Missing));
        }

        var outcome = await _zalo.CallWithTokenAsync(connection,
            token => _zaloApi.SendTemplateMessageAsync(
                token, phone, detail.TemplateId, check.ZnsValues!, GuidGenerator.Create().ToString("N")),
            o => o.Call);
        using (var uow = UnitOfWorkManager.Begin(requiresNew: true))
        {
            await _zalo.LogAsync(branchId, "zns-send-test", outcome.Call, outcome.Call.Succeeded ? 1 : 0);
            await uow.CompleteAsync();
        }

        if (!outcome.Call.Succeeded)
        {
            throw ZaloOaGateway.Refused(outcome.Call);
        }

        return new MessageTestSendDto { Phone = user.PhoneNumber! };
    }

    private async Task<Guid> GetBranchIdAsync()
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        await _branchAccess.CheckAsync(branchId);
        return branchId;
    }

    private async Task<MessageTemplate> GetTemplateAsync(Guid branchId, Guid id) =>
        await _templates.FirstOrDefaultAsync(t => t.Id == id && t.ClinicBranchId == branchId)
        ?? throw new EntityNotFoundException(typeof(MessageTemplate), id);

    private async Task<MessageSendBatch> GetBatchAsync(Guid id)
    {
        var branchId = await GetBranchIdAsync();
        return await _batches.FirstOrDefaultAsync(b => b.Id == id && b.ClinicBranchId == branchId)
            ?? throw new EntityNotFoundException(typeof(MessageSendBatch), id);
    }

    /// <summary>Only Zalo has a provider, and only once the branch's OA is linked and switched on.</summary>
    private async Task<ZaloOaConnection> GetSendingConnectionAsync(Guid branchId, MessageChannelType channel)
    {
        var connection = channel == MessageChannelType.Zalo ? await _zalo.FindConnectionAsync(branchId) : null;
        return connection is { CanSend: true }
            ? connection
            : throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendChannelNotConnected);
    }

    /// <summary>
    /// The linked ZNS template's parameters and price, for the table's checks.
    /// Zalo out of reach leaves them unknown; "Gửi" asks again and stops there.
    /// </summary>
    private async Task<ZaloTemplateDetail?> TryReadZnsAsync(Guid branchId, MessageTemplate? template)
    {
        if (template is not { Channel: MessageChannelType.Zalo, ExternalTemplateId: { } externalId })
        {
            return null;
        }

        var connection = await _zalo.FindConnectionAsync(branchId);
        if (connection == null)
        {
            return null;
        }

        try
        {
            return await _zalo.FetchTemplateDetailAsync(branchId, connection, externalId);
        }
        catch (BusinessException ex) when (ex.Code == BlueDentalDomainErrorCodes.Tools.ZaloRequestFailed)
        {
            return null;
        }
    }

    /// <summary>
    /// The customer's values as the viewer may see them, or the library's
    /// examples. A patient with an appointment named fills the visit from it;
    /// an appointment alone is a "Lịch tạm" guest.
    /// </summary>
    private async Task<(IReadOnlyDictionary<string, string?> Values, bool IsSample)> ResolveValuesAsync(
        Guid branchId, Guid? patientId, Guid? appointmentId)
    {
        IReadOnlyDictionary<string, string?> values;
        if (patientId is { } id)
        {
            var patient = await _patients.FirstOrDefaultAsync(p => p.Id == id && p.BranchId == branchId)
                ?? throw new EntityNotFoundException(typeof(Patient), id);
            var pinned = appointmentId is { } visit ? new Dictionary<Guid, Guid> { [id] = visit } : null;
            values = (await _variables.ResolveAsync(branchId, [patient], pinned))[id];
        }
        else if (appointmentId is { } bookingId)
        {
            var booking = await _appointments.FirstOrDefaultAsync(a => a.Id == bookingId && a.BranchId == branchId)
                ?? throw new EntityNotFoundException(typeof(Appointment), bookingId);
            values = (await _variables.ResolveGuestsAsync(branchId, [booking]))[bookingId];
        }
        else
        {
            return (MessageVariables.Examples, true);
        }

        return (await _masker.MaskAsync(values), false);
    }

    private async Task<Dictionary<Guid, BatchCounts>> CountAsync(IReadOnlyCollection<Guid> batchIds)
    {
        if (batchIds.Count == 0)
        {
            return [];
        }

        var rows = await AsyncExecuter.ToListAsync((await _messages.GetQueryableAsync())
            .Where(m => m.SendBatchId != null && batchIds.Contains(m.SendBatchId.Value))
            .GroupBy(m => new { BatchId = m.SendBatchId!.Value, m.Status })
            .Select(g => new { g.Key.BatchId, g.Key.Status, Count = g.Count() }));
        return rows.GroupBy(r => r.BatchId).ToDictionary(
            g => g.Key,
            g => new BatchCounts(
                g.Where(r => MessageTemplateUsageReader.Delivered.Contains(r.Status)).Sum(r => r.Count),
                g.Where(r => r.Status == MessageSendStatus.Failed).Sum(r => r.Count),
                g.Where(r => r.Status == MessageSendStatus.Pending).Sum(r => r.Count)));
    }

    private static MessageRecipientDto ToRecipientDto(MessageRecipient r) => new()
    {
        Key = r.Key,
        PatientId = r.PatientId,
        CareRecordId = r.CareRecordId,
        Name = r.Name,
        Code = r.Code,
        Phone = r.Phone,
        Email = r.Email,
        DentistName = r.DentistName,
        ReceivedAt = r.ReceivedAt,
        SkipReason = r.SkipReason,
        Missing = [.. r.Missing],
    };

    private static MessageSendBatchDto ToBatchDto(MessageSendBatch b, BatchCounts counts) => new()
    {
        Id = b.Id,
        Channel = b.Channel,
        TemplateId = b.TemplateId,
        TemplateName = b.TemplateName,
        Source = b.Source,
        CareType = b.CareType,
        FromDate = b.FromDate,
        ToDate = b.ToDate,
        SkipRecentDuplicates = b.SkipRecentDuplicates,
        ScheduledAt = b.ScheduledAt,
        Status = b.Status,
        RecipientCount = b.RecipientCount,
        SkippedCount = b.SkippedCount,
        SentCount = counts.Sent,
        FailedCount = counts.Failed,
        PendingCount = counts.Pending,
        CreationTime = b.CreationTime,
        CompletedAt = b.CompletedAt,
    };

    private sealed record BatchCounts(int Sent, int Failed, int Pending)
    {
        public static readonly BatchCounts None = new(0, 0, 0);
    }
}
