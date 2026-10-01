using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Zalo;

/// <summary>
/// The reference's <c>/zalo-oa/status</c> row plus what the config panel shows
/// once linked. Tokens never appear here.
/// </summary>
public class ZaloOaStatusDto
{
    public Guid? Id { get; set; }
    public Guid BranchId { get; set; }
    public bool IsConnected { get; set; }
    public bool IsEnabled { get; set; }

    /// <summary><c>none</c>, <c>active</c>, <c>failed</c> or <c>expired</c>.</summary>
    public string Status { get; set; } = ZaloOaStatusText.None;

    public string? OaId { get; set; }
    public string? OaName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? PackageName { get; set; }
    public DateTime? ConnectedAt { get; set; }
    public DateTime? LastRefreshedAt { get; set; }
    public DateTime? AccessTokenExpiresAt { get; set; }
    public string? LastError { get; set; }

    /// <summary>The server holds a portal token pair that can be imported without OAuth.</summary>
    public bool HasBootstrapTokens { get; set; }

    /// <summary>The server has app credentials, so the OAuth button can work.</summary>
    public bool CanConnect { get; set; }
}

public static class ZaloOaStatusText
{
    public const string None = "none";
    public const string Active = "active";
    public const string Failed = "failed";
    public const string Expired = "expired";
}

public class ZaloConnectUrlDto
{
    public string Url { get; set; } = string.Empty;
}

/// <summary>Where the browser goes after Zalo's OAuth callback has been handled.</summary>
public class ZaloOAuthCallbackResultDto
{
    public string RedirectUrl { get; set; } = string.Empty;
}

public class SetZaloEnabledInput
{
    public bool IsEnabled { get; set; }
}

public class GetZaloTemplatesInput : PagedResultRequestDto
{
    /// <summary>Zalo's filter: 1 enable, 2 pending review, 3 reject, 4 disable. Null lists all.</summary>
    [Range(1, 4)]
    public int? Status { get; set; }
}

public class ZaloTemplateDto
{
    public string TemplateId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Status { get; set; }
    public string? Quality { get; set; }
    public DateTime? CreatedAt { get; set; }
}

public class ZaloTemplateParamDto
{
    public string Name { get; set; } = string.Empty;
    public bool Required { get; set; }
    public string? Type { get; set; }
    public int? MaxLength { get; set; }
    public int? MinLength { get; set; }
    public bool AcceptNull { get; set; }
}

public class ZaloTemplateDetailDto : ZaloTemplateDto
{
    public string? PreviewUrl { get; set; }
    public decimal? Price { get; set; }
    public int? TimeoutMs { get; set; }
    public List<ZaloTemplateParamDto> Params { get; set; } = [];
}

/// <summary>
/// One ZNS to one customer. The recipient comes from the care record or the
/// patient; <see cref="Phone"/> only overrides what the record holds.
/// </summary>
public class SendZaloMessageInput
{
    public Guid? PatientId { get; set; }
    public Guid? CareRecordId { get; set; }

    [StringLength(30)]
    public string? Phone { get; set; }

    [Required]
    [StringLength(50)]
    public string TemplateId { get; set; } = string.Empty;

    /// <summary>Explicit parameter values; anything not given is filled from the customer.</summary>
    public Dictionary<string, string>? TemplateData { get; set; }
}

public class GetZaloMessagesInput : PagedResultRequestDto
{
    public string? Filter { get; set; }

    /// <summary>A <c>MessageSendStatus</c> value.</summary>
    public int? Status { get; set; }

    /// <summary>True = sent or delivered, false = failed. Null = everything.</summary>
    public bool? Succeeded { get; set; }

    /// <summary>Inclusive lower bound on <c>CreationTime</c> (UTC).</summary>
    public DateTime? DateFrom { get; set; }

    /// <summary>Inclusive upper bound on <c>CreationTime</c> (UTC).</summary>
    public DateTime? DateTo { get; set; }
}

public class ZaloMessageDto
{
    public Guid Id { get; set; }
    public Guid? PatientId { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int Status { get; set; }
    public decimal? Cost { get; set; }
    public DateTime? SentAt { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ExternalTemplateId { get; set; }
    public string? ExternalMessageId { get; set; }
    public string? TemplateName { get; set; }
    public DateTime CreationTime { get; set; }
}

public class ZaloMessageStatsDto
{
    public int Total { get; set; }
    public int Success { get; set; }
    public int Failed { get; set; }
}
