using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Tools;
using BlueDental.TreatmentManagement;
using BlueDental.Zalo;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// CSKH ▸ Template tin nhắn (BA P2110, F-76). Everything is the current
/// branch's: its templates, its customers for the preview, its Zalo OA.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.CskhTemplate.Read)]
public class MessageTemplateAppService : BlueDentalAppService, IMessageTemplateAppService
{
    /// <summary>The list's order within a channel: what can be sent first.</summary>
    internal static readonly MessageTemplateStatus[] StatusOrder =
    [
        MessageTemplateStatus.Ready,
        MessageTemplateStatus.PendingApproval,
        MessageTemplateStatus.Draft,
        MessageTemplateStatus.Rejected,
        MessageTemplateStatus.Disabled,
    ];

    private readonly IRepository<MessageTemplate, Guid> _templates;
    private readonly MessageTemplateUsageReader _usage;
    private readonly IRepository<Patient, Guid> _patients;
    private readonly IRepository<Appointment, Guid> _appointments;
    private readonly MessageVariableResolver _variables;
    private readonly ZaloOaGateway _zalo;
    private readonly MessageValueMasker _masker;
    private readonly BranchAccessChecker _branchAccess;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public MessageTemplateAppService(
        IRepository<MessageTemplate, Guid> templates,
        MessageTemplateUsageReader usage,
        IRepository<Patient, Guid> patients,
        IRepository<Appointment, Guid> appointments,
        MessageVariableResolver variables,
        ZaloOaGateway zalo,
        MessageValueMasker masker,
        BranchAccessChecker branchAccess,
        ICurrentClinicBranchResolver branchResolver)
    {
        _templates = templates;
        _usage = usage;
        _patients = patients;
        _appointments = appointments;
        _variables = variables;
        _zalo = zalo;
        _masker = masker;
        _branchAccess = branchAccess;
        _branchResolver = branchResolver;
    }

    public async Task<MessageTemplateListDto> GetListAsync(GetMessageTemplateListInput input)
    {
        var branchId = await GetBranchIdAsync();
        var all = await _templates.GetListAsync(t => t.ClinicBranchId == branchId);

        var words = Fold(input.Filter);
        var matching = all
            .Where(t => input.Purpose == null || t.Purpose == input.Purpose)
            .Where(t => words.Length == 0 || Fold(t.Name).Contains(words) || Fold(t.Content).Contains(words))
            .ToList();
        var shown = matching
            .Where(t => input.Channel == null || t.Channel == input.Channel)
            .OrderBy(t => t.Channel)
            .ThenBy(t => Array.IndexOf(StatusOrder, t.Status))
            .ThenBy(t => t.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToList();

        var usage = await _usage.LoadAsync(branchId, shown.Select(t => t.Id).ToList());
        return new MessageTemplateListDto
        {
            Items = [.. shown.Select(t => ToDto(t, usage.GetValueOrDefault(t.Id)))],
            AllCount = matching.Count,
            SmsCount = matching.Count(t => t.Channel == MessageChannelType.Sms),
            ZaloCount = matching.Count(t => t.Channel == MessageChannelType.Zalo),
            EmailCount = matching.Count(t => t.Channel == MessageChannelType.Email),
        };
    }

    public async Task<MessageTemplateDto> GetAsync(Guid id)
    {
        var template = await GetTemplateAsync(id);
        return await ToDtoWithUsageAsync(template);
    }

    [Authorize(BlueDentalAbilityPermissions.CskhTemplate.Create)]
    public async Task<MessageTemplateDto> CreateAsync(CreateMessageTemplateInput input)
    {
        var branchId = await GetBranchIdAsync();
        var content = ToContent(input);
        MessageTemplate template;
        if (!input.Publish)
        {
            template = MessageTemplate.CreateDraft(GuidGenerator.Create(), branchId, input.Channel, content);
        }
        else
        {
            var zns = await ReadZnsAsync(branchId, input.Channel, input.ExternalTemplateId);
            template = MessageTemplate.CreatePublished(
                GuidGenerator.Create(), branchId, input.Channel, content, zns?.Required, zns?.Status);
        }

        await _templates.InsertAsync(template, autoSave: true);
        return ToDto(template, null);
    }

    [Authorize(BlueDentalAbilityPermissions.CskhTemplate.Update)]
    public async Task<MessageTemplateDto> UpdateAsync(Guid id, SaveMessageTemplateInput input)
    {
        var template = await GetTemplateAsync(id);
        var content = ToContent(input);
        if (!input.Publish)
        {
            template.SaveDraft(content);
        }
        else
        {
            var zns = await ReadZnsAsync(template.ClinicBranchId, template.Channel, input.ExternalTemplateId);
            template.Publish(content, zns?.Required, zns?.Status);
        }

        await _templates.UpdateAsync(template, autoSave: true);
        return await ToDtoWithUsageAsync(template);
    }

    [Authorize(BlueDentalAbilityPermissions.CskhTemplate.Create)]
    public async Task<MessageTemplateDto> DuplicateAsync(Guid id)
    {
        var source = await GetTemplateAsync(id);
        var copy = source.Duplicate(GuidGenerator.Create(), L["CSKH:Template:CopyName", source.Name]);
        await _templates.InsertAsync(copy, autoSave: true);
        return ToDto(copy, null);
    }

    public Task<List<MessageVariableDto>> GetVariablesAsync() =>
        Task.FromResult(MessageVariables.All.Select(v => new MessageVariableDto
        {
            Key = v.Key,
            Group = v.Group,
            Example = v.Example,
            WhenEmpty = v.WhenEmpty,
            Fallback = v.Fallback,
            IsCommon = v.IsCommon,
        }).ToList());

    public async Task<MessageSampleCustomerDto> GetSampleCustomerAsync(Guid? exceptPatientId)
    {
        var branchId = await GetBranchIdAsync();
        var branchPatients = (await _patients.GetQueryableAsync()).Where(p => p.BranchId == branchId);
        var patients = exceptPatientId is { } skip ? branchPatients.Where(p => p.Id != skip) : branchPatients;

        // A customer with a visit ahead fills the appointment variables too.
        var from = ClinicCalendar.StartOfDay(ClinicCalendar.DateOf(Clock.Now));
        var appointments = await _appointments.GetQueryableAsync();
        var withVisit = patients.Where(p => appointments.Any(a =>
            a.PatientId == p.Id && a.BranchId == branchId && !a.IsTemporary
            && MessageVariableResolver.Upcoming.Contains(a.Status) && a.Slot.Start >= from));

        // A branch with a single customer keeps showing that one on "Đổi khách".
        var patient = await PickRandomAsync(withVisit)
            ?? await PickRandomAsync(patients)
            ?? await PickRandomAsync(branchPatients);
        return new MessageSampleCustomerDto
        {
            PatientId = patient?.Id,
            Name = patient?.FullName,
            Code = patient?.PatientCode,
        };
    }

    public async Task<MessagePreviewDto> PreviewAsync(PreviewMessageTemplateInput input)
    {
        var branchId = await GetBranchIdAsync();
        var values = MessageVariables.Examples;
        var isSample = true;
        if (input.PatientId is { } patientId)
        {
            var patient = await _patients.FirstOrDefaultAsync(p => p.Id == patientId && p.BranchId == branchId)
                ?? throw new EntityNotFoundException(typeof(Patient), patientId);
            var resolved = await _variables.ResolveAsync(branchId, [patient]);
            values = await _masker.MaskAsync(resolved[patient.Id]);
            isSample = false;
        }

        return BuildPreview(input, values, isSample);
    }

    public async Task<List<ZaloTemplateDto>> GetZnsTemplatesAsync()
    {
        var branchId = await GetBranchIdAsync();
        var connection = await _zalo.GetConnectionAsync(branchId);
        var templates = await _zalo.FetchAllTemplatesAsync(branchId, connection);
        return [.. templates.Select(ZaloOaAppService.ToTemplateDto)];
    }

    public async Task<ZaloTemplateDetailDto> GetZnsTemplateAsync(string templateId)
    {
        var branchId = await GetBranchIdAsync();
        var connection = await _zalo.GetConnectionAsync(branchId);
        var detail = await _zalo.FetchTemplateDetailAsync(branchId, connection, templateId);
        return ZaloOaAppService.ToTemplateDetailDto(detail);
    }

    /// <summary>
    /// Called as the list opens, so a Read is enough: it copies Zalo's review
    /// outcome, nothing the user typed. A ZNS template the OA no longer lists
    /// was deleted there and stops being usable here.
    /// </summary>
    public async Task<SyncZaloTemplateStatusDto> SyncZaloStatusAsync()
    {
        var branchId = await GetBranchIdAsync();
        var connection = await _zalo.FindConnectionAsync(branchId);
        if (connection == null)
        {
            return new SyncZaloTemplateStatusDto { Connected = false };
        }

        var linked = await _templates.GetListAsync(t =>
            t.ClinicBranchId == branchId && t.Channel == MessageChannelType.Zalo
            && t.ExternalTemplateId != null && t.Status != MessageTemplateStatus.Draft);
        if (linked.Count == 0)
        {
            return new SyncZaloTemplateStatusDto { Connected = true };
        }

        IReadOnlyList<ZaloTemplateSummary> onZalo;
        try
        {
            onZalo = await _zalo.FetchAllTemplatesAsync(branchId, connection);
        }
        catch (BusinessException ex) when (ex.Code == BlueDentalDomainErrorCodes.Tools.ZaloRequestFailed)
        {
            // The list keeps the statuses it had; the tab says Zalo could not be read.
            return new SyncZaloTemplateStatusDto { Connected = true, Error = ex.Data["message"]?.ToString() };
        }

        var statusOf = onZalo.ToDictionary(z => z.TemplateId, z => z.Status, StringComparer.Ordinal);
        var changed = new List<MessageTemplate>();
        foreach (var template in linked)
        {
            var before = template.Status;
            template.SyncZaloStatus(statusOf.TryGetValue(template.ExternalTemplateId!, out var status) ? status : "DELETE");
            if (template.Status != before)
            {
                changed.Add(template);
            }
        }

        await _templates.UpdateManyAsync(changed, autoSave: true);
        return new SyncZaloTemplateStatusDto { Connected = true, Updated = changed.Count };
    }

    private async Task<Guid> GetBranchIdAsync()
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        await _branchAccess.CheckAsync(branchId);
        return branchId;
    }

    private async Task<MessageTemplate> GetTemplateAsync(Guid id)
    {
        var branchId = await GetBranchIdAsync();
        return await _templates.FirstOrDefaultAsync(t => t.Id == id && t.ClinicBranchId == branchId)
            ?? throw new EntityNotFoundException(typeof(MessageTemplate), id);
    }

    /// <summary>For "Lưu mẫu" of a Zalo template: what Zalo says about the linked ZNS template.</summary>
    private async Task<ZnsFacts?> ReadZnsAsync(Guid branchId, MessageChannelType channel, string? templateId)
    {
        if (channel != MessageChannelType.Zalo || string.IsNullOrWhiteSpace(templateId))
        {
            // The entity refuses a Zalo template with no ZNS link itself.
            return null;
        }

        var connection = await _zalo.GetConnectionAsync(branchId);
        var detail = await _zalo.FetchTemplateDetailAsync(branchId, connection, templateId.Trim());
        return new ZnsFacts(
            [.. detail.Params.Where(p => p.Required).Select(p => p.Name)],
            detail.Status);
    }

    private static MessagePreviewDto BuildPreview(
        PreviewMessageTemplateInput input, IReadOnlyDictionary<string, string?> values, bool isSample) =>
        ToPreviewDto(
            input.Channel,
            MessageComposer.Compose(input.Channel, input.Content, input.Subject, input.ParamMap, input.RemoveDiacritics, values),
            isSample);

    internal static MessagePreviewDto ToPreviewDto(MessageChannelType channel, ComposedMessage message, bool isSample) => new()
    {
        IsSample = isSample,
        Text = message.Text,
        Subject = message.Subject,
        Params = [.. message.Params.Select(p => new MessagePreviewParamDto { Name = p.Name, Value = p.Value })],
        Measure = channel == MessageChannelType.Sms ? ToMeasure(SmsLength.Measure(message.Text)) : null,
        Missing = [.. message.Missing],
        Unknown = [.. message.Unknown],
    };

    private async Task<Patient?> PickRandomAsync(IQueryable<Patient> query)
    {
        var count = await AsyncExecuter.CountAsync(query);
        if (count == 0)
        {
            return null;
        }

        return await AsyncExecuter.FirstOrDefaultAsync(
            query.OrderBy(p => p.Id).Skip(Random.Shared.Next(count)));
    }

    private async Task<MessageTemplateDto> ToDtoWithUsageAsync(MessageTemplate template)
    {
        var usage = await _usage.LoadAsync(template.ClinicBranchId, [template.Id]);
        return ToDto(template, usage.GetValueOrDefault(template.Id));
    }

    internal static MessageTemplateDto ToDto(MessageTemplate t, MessageTemplateUsage? usage) => new()
    {
        Id = t.Id,
        Name = t.Name,
        Content = t.Content,
        Channel = t.Channel,
        Purpose = t.Purpose,
        Status = t.Status,
        Subject = t.Subject,
        ExternalTemplateId = t.ExternalTemplateId,
        ParamMap = new Dictionary<string, string>(t.GetParamMap()),
        RemoveDiacritics = t.RemoveDiacritics,
        Variables = [.. t.GetVariables()],
        SentCount = usage?.Count ?? 0,
        LastUsedAt = usage?.LastSentAt,
        Measure = t.Channel == MessageChannelType.Sms
            ? ToMeasure(SmsLength.Measure(
                MessageTemplateRenderer.Render(t.Content, MessageVariables.Examples, t.RemoveDiacritics).Text))
            : null,
        CreationTime = t.CreationTime,
        LastModificationTime = t.LastModificationTime,
    };

    private static SmsMeasureDto ToMeasure(SmsMeasure m) => new()
    {
        Characters = m.Characters,
        Segments = m.Segments,
        PerMessage = m.PerMessage,
        Unicode = m.Unicode,
    };

    private static MessageTemplateContent ToContent(SaveMessageTemplateInput input) => new(
        input.Name, input.Purpose, input.Content, input.Subject,
        input.ExternalTemplateId, input.ParamMap, input.RemoveDiacritics);

    /// <summary>Lower case without Vietnamese marks, so "nhac lich" finds "Nhắc lịch".</summary>
    private static string Fold(string? text) =>
        MessageTemplateRenderer.StripDiacritics(text?.Trim() ?? string.Empty).ToLowerInvariant();

    private sealed record ZnsFacts(IReadOnlyCollection<string> Required, string? Status);
}
