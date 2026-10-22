using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using BlueDental.CustomerCare;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Tools;

/// <summary>
/// A message template of CSKH ▸ Template tin nhắn (BA P2110, F-76).
///
/// One template serves exactly one <see cref="Channel"/>, fixed when it is
/// created. "Lưu nháp" keeps whatever was typed as <see cref="MessageTemplateStatus.Draft"/>;
/// "Lưu mẫu" checks the template is complete for its channel first. An SMS or
/// Email template is then <see cref="MessageTemplateStatus.Ready"/>; a Zalo one
/// is a link to a ZNS template the OA registered, so its status is whatever
/// Zalo says about that ZNS template.
///
/// The older Công cụ ▸ Mẫu tin nhắn screen wrote rows through the public
/// constructor; those carry no purpose and stay usable as they were.
/// </summary>
public class MessageTemplate : FullAuditedEntity<Guid>
{
    public const int MaxNameLength = MessageTemplateConsts.MaxNameLength;
    public const int MaxContentLength = MessageTemplateConsts.MaxContentLength;
    public const int MaxSmsContentLength = 1000;
    public const int MaxZaloContentLength = 2000;
    public const int MaxSubjectLength = MessageTemplateConsts.MaxSubjectLength;
    public const int MaxExternalTemplateIdLength = MessageTemplateConsts.MaxExternalTemplateIdLength;
    public const int MaxParamValueLength = 500;
    public const int MaxCategoryLength = 100;

    private static readonly JsonSerializerOptions JsonOptions = new();

    public Guid ClinicBranchId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Content { get; private set; } = string.Empty;
    public MessageChannelType Channel { get; private set; }
    public string? Category { get; private set; }
    public bool IsActive { get; private set; }

    /// <summary>The CSKH tab the template is written for ("Mục đích").</summary>
    public CareType? Purpose { get; private set; }

    public MessageTemplateStatus Status { get; private set; }

    /// <summary>Email only: the subject line.</summary>
    public string? Subject { get; private set; }

    /// <summary>Zalo only: the ZNS template id on the OA.</summary>
    public string? ExternalTemplateId { get; private set; }

    /// <summary>Zalo only: ZNS parameter → what to put there, as JSON. Values may quote variables.</summary>
    public string ParamMapJson { get; private set; } = "{}";

    /// <summary>SMS only: "Tự bỏ dấu tiếng Việt".</summary>
    public bool RemoveDiacritics { get; private set; }

    private MessageTemplate() { }

    /// <summary>The Công cụ screen's template: no purpose, usable at once.</summary>
    public MessageTemplate(
        Guid id, Guid clinicBranchId, string name, string content,
        MessageChannelType channel, string? category)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        Name = name;
        Content = content;
        Channel = channel;
        Category = category;
        IsActive = true;
        Status = MessageTemplateStatus.Ready;
    }

    public static MessageTemplate CreateDraft(
        Guid id, Guid clinicBranchId, MessageChannelType channel, MessageTemplateContent content)
    {
        var template = new MessageTemplate(id, clinicBranchId, string.Empty, string.Empty, channel, null);
        template.SaveDraft(content);
        return template;
    }

    public static MessageTemplate CreatePublished(
        Guid id, Guid clinicBranchId, MessageChannelType channel, MessageTemplateContent content,
        IReadOnlyCollection<string>? requiredZaloParams = null, string? zaloStatus = null)
    {
        var template = new MessageTemplate(id, clinicBranchId, string.Empty, string.Empty, channel, null);
        template.Publish(content, requiredZaloParams, zaloStatus);
        return template;
    }

    /// <summary>"Lưu nháp": only a name is needed; nothing else is checked beyond length.</summary>
    public void SaveDraft(MessageTemplateContent content)
    {
        Apply(content);
        Status = MessageTemplateStatus.Draft;
    }

    /// <summary>
    /// "Lưu mẫu": the template must be complete for its channel. For Zalo,
    /// <paramref name="requiredZaloParams"/> are the ZNS parameters Zalo marks
    /// required and <paramref name="zaloStatus"/> is Zalo's word for the ZNS
    /// template (ENABLE, PENDING_REVIEW…).
    /// </summary>
    public void Publish(
        MessageTemplateContent content,
        IReadOnlyCollection<string>? requiredZaloParams = null,
        string? zaloStatus = null)
    {
        Apply(content);

        if (Purpose is not { } purpose || !CareBoard.IsTab(purpose))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.TemplatePurposeRequired);
        }

        if (Channel == MessageChannelType.Zalo)
        {
            EnsureZaloComplete(requiredZaloParams ?? []);
            Status = MessageTemplateStatusMap.FromZalo(zaloStatus);
            return;
        }

        if (string.IsNullOrWhiteSpace(Content))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.TemplateContentRequired);
        }

        if (Channel == MessageChannelType.Email && string.IsNullOrWhiteSpace(Subject))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.TemplateSubjectRequired);
        }

        EnsureKnownVariables(Content, Subject);
        Status = MessageTemplateStatus.Ready;
    }

    /// <summary>Zalo re-reviewed the linked ZNS template. Drafts stay drafts.</summary>
    public void SyncZaloStatus(string? zaloStatus)
    {
        if (Channel != MessageChannelType.Zalo || Status == MessageTemplateStatus.Draft)
        {
            return;
        }

        Status = MessageTemplateStatusMap.FromZalo(zaloStatus);
    }

    /// <summary>"Nhân bản": a draft copy in the same branch and channel.</summary>
    public MessageTemplate Duplicate(Guid id, string copyName)
    {
        var copy = new MessageTemplate(id, ClinicBranchId, string.Empty, string.Empty, Channel, null);
        copy.SaveDraft(ToContent() with { Name = Clip(copyName.Trim(), MaxNameLength) });
        return copy;
    }

    /// <summary>The Công cụ screen's edit.</summary>
    public void Update(string name, string content, string? category)
    {
        Name = name;
        Content = content;
        Category = category;
    }

    public void SetActive(bool active) => IsActive = active;

    /// <summary>"Sẵn sàng" and switched on; a Zalo one of the older Công cụ screen is ready without a ZNS link, which Zalo needs.</summary>
    public bool CanSend => IsActive && Status == MessageTemplateStatus.Ready
        && (Channel != MessageChannelType.Zalo || !string.IsNullOrWhiteSpace(ExternalTemplateId));

    public IReadOnlyDictionary<string, string> GetParamMap() =>
        JsonSerializer.Deserialize<Dictionary<string, string>>(ParamMapJson, JsonOptions)
        ?? new Dictionary<string, string>();

    public MessageTemplateContent ToContent() => new(
        Name, Purpose, Content, Subject, ExternalTemplateId, GetParamMap(), RemoveDiacritics);

    /// <summary>Every variable the template quotes, in first-seen order.</summary>
    public IReadOnlyList<string> GetVariables() => Channel == MessageChannelType.Zalo
        ? MessageTemplateRenderer.FindVariables(string.Join(" ", GetParamMap().Values))
        : MessageTemplateRenderer.FindVariables(string.Join(" ", Subject, Content));

    private void Apply(MessageTemplateContent content)
    {
        var name = content.Name?.Trim();
        if (string.IsNullOrEmpty(name))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.TemplateNameRequired);
        }

        EnsureMaxLength(name, MaxNameLength);
        Name = name;
        Purpose = content.Purpose;

        // Each channel keeps only its own fields, so nothing typed for another
        // channel's card can ride along.
        Subject = null;
        ExternalTemplateId = null;
        ParamMapJson = "{}";
        RemoveDiacritics = false;

        switch (Channel)
        {
            case MessageChannelType.Sms:
                Content = Normalize(content.Content, MaxSmsContentLength);
                RemoveDiacritics = content.RemoveDiacritics;
                break;
            case MessageChannelType.Email:
                Content = Normalize(content.Content, MaxContentLength);
                Subject = NullIfEmpty(Normalize(content.Subject, MaxSubjectLength));
                break;
            case MessageChannelType.Zalo:
                ExternalTemplateId = NullIfEmpty(Normalize(content.ExternalTemplateId, MaxExternalTemplateIdLength));
                var map = NormalizeParamMap(content.ParamMap);
                ParamMapJson = JsonSerializer.Serialize(map, JsonOptions);
                Content = Clip(DescribeParamMap(map), MaxZaloContentLength);
                break;
        }
    }

    private void EnsureZaloComplete(IReadOnlyCollection<string> requiredParams)
    {
        if (ExternalTemplateId == null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.TemplateZnsRequired);
        }

        var map = GetParamMap();
        var unmapped = requiredParams
            .Where(p => !map.TryGetValue(p, out var value) || string.IsNullOrWhiteSpace(value))
            .ToList();
        if (unmapped.Count > 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.TemplateZnsParamUnmapped)
                .WithData("params", string.Join(", ", unmapped));
        }

        EnsureKnownVariables(map.Values.ToArray());
    }

    private static void EnsureKnownVariables(params string?[] texts)
    {
        var unknown = texts
            .SelectMany(t => MessageTemplateRenderer.FindVariables(t ?? string.Empty))
            .Where(key => !MessageVariables.IsKnown(key))
            .Distinct()
            .ToList();
        if (unknown.Count > 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.TemplateUnknownVariables)
                .WithData("variables", string.Join(", ", unknown.Select(k => "{" + k + "}")));
        }
    }

    private static Dictionary<string, string> NormalizeParamMap(IReadOnlyDictionary<string, string>? map)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (param, value) in map ?? new Dictionary<string, string>())
        {
            var key = param?.Trim();
            var text = value?.Trim();
            if (string.IsNullOrEmpty(key) || string.IsNullOrEmpty(text))
            {
                continue;
            }

            EnsureMaxLength(key, MaxExternalTemplateIdLength);
            EnsureMaxLength(text, MaxParamValueLength);
            result[key] = text;
        }

        return result;
    }

    /// <summary>What the list's snippet and search see of a Zalo template.</summary>
    private static string DescribeParamMap(IReadOnlyDictionary<string, string> map) =>
        string.Join(" · ", map.Select(p => $"{p.Key}: {p.Value}"));

    private static string Normalize(string? value, int max)
    {
        var text = value?.Trim() ?? string.Empty;
        EnsureMaxLength(text, max);
        return text;
    }

    private static void EnsureMaxLength(string value, int max)
    {
        if (value.Length > max)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.TemplateTooLong)
                .WithData("max", max);
        }
    }

    private static string? NullIfEmpty(string value) => value.Length == 0 ? null : value;

    private static string Clip(string value, int max) => value.Length > max ? value[..max] : value;
}

/// <summary>Everything the editor sends; each channel reads only its own fields.</summary>
public sealed record MessageTemplateContent(
    string? Name,
    CareType? Purpose,
    string? Content,
    string? Subject,
    string? ExternalTemplateId,
    IReadOnlyDictionary<string, string>? ParamMap,
    bool RemoveDiacritics);

public static class MessageTemplateStatusMap
{
    /// <summary>Zalo's words for a ZNS template (template/all, template/info).</summary>
    public static MessageTemplateStatus FromZalo(string? status) => status?.Trim().ToUpperInvariant() switch
    {
        "ENABLE" => MessageTemplateStatus.Ready,
        "PENDING_REVIEW" => MessageTemplateStatus.PendingApproval,
        "REJECT" => MessageTemplateStatus.Rejected,
        "DISABLE" or "DELETE" => MessageTemplateStatus.Disabled,
        _ => MessageTemplateStatus.PendingApproval,
    };
}
