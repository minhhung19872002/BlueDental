using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using BlueDental.Tools;
using Volo.Abp.Application.Dtos;

namespace BlueDental.CustomerCare.Messaging;

public class GetMessageTemplateListInput
{
    public MessageChannelType? Channel { get; set; }

    /// <summary>"Mục đích": one of the /cskh-grouping tabs.</summary>
    public CareType? Purpose { get; set; }

    /// <summary>"Tìm theo tên mẫu hoặc nội dung"; accents and case are ignored.</summary>
    [StringLength(200)]
    public string? Filter { get; set; }
}

/// <summary>
/// The whole list of a branch (no paging: a branch keeps tens of templates).
/// The channel counts follow the search and the purpose but not the channel,
/// so each filter pill says what picking it would show.
/// </summary>
public class MessageTemplateListDto
{
    public List<MessageTemplateDto> Items { get; set; } = [];
    public int AllCount { get; set; }
    public int SmsCount { get; set; }
    public int ZaloCount { get; set; }
    public int EmailCount { get; set; }
}

public class MessageTemplateDto : EntityDto<Guid>
{
    public string Name { get; set; } = string.Empty;

    /// <summary>The text with its <c>{variables}</c>; for Zalo, a description of the parameter map.</summary>
    public string Content { get; set; } = string.Empty;

    public MessageChannelType Channel { get; set; }

    /// <summary>Null for templates written on the older Công cụ screen.</summary>
    public CareType? Purpose { get; set; }

    public MessageTemplateStatus Status { get; set; }
    public string? Subject { get; set; }
    public string? ExternalTemplateId { get; set; }
    public Dictionary<string, string> ParamMap { get; set; } = [];
    public bool RemoveDiacritics { get; set; }

    /// <summary>The variables the template quotes, in first-seen order ("SỐ BIẾN" counts them).</summary>
    public List<string> Variables { get; set; } = [];

    /// <summary>"ĐÃ GỬI": messages sent with this template, all time.</summary>
    public int SentCount { get; set; }

    /// <summary>"Dùng lần cuối".</summary>
    public DateTime? LastUsedAt { get; set; }

    /// <summary>SMS only: the length once the variables take their example values.</summary>
    public SmsMeasureDto? Measure { get; set; }

    public DateTime CreationTime { get; set; }
    public DateTime? LastModificationTime { get; set; }
}

public class SmsMeasureDto
{
    public int Characters { get; set; }

    /// <summary>"N tin SMS".</summary>
    public int Segments { get; set; }

    /// <summary>160 without accents, 70 with.</summary>
    public int PerMessage { get; set; }

    public bool Unicode { get; set; }
}

/// <summary>What the editor sends. Each channel reads only its own fields.</summary>
public class SaveMessageTemplateInput
{
    /// <summary>true = "Lưu mẫu" (checked complete); false = "Lưu nháp".</summary>
    public bool Publish { get; set; }

    [StringLength(MessageTemplateConsts.MaxNameLength)]
    public string? Name { get; set; }

    public CareType? Purpose { get; set; }

    [StringLength(MessageTemplateConsts.MaxContentLength)]
    public string? Content { get; set; }

    [StringLength(MessageTemplateConsts.MaxSubjectLength)]
    public string? Subject { get; set; }

    [StringLength(MessageTemplateConsts.MaxExternalTemplateIdLength)]
    public string? ExternalTemplateId { get; set; }

    public Dictionary<string, string>? ParamMap { get; set; }

    public bool RemoveDiacritics { get; set; }
}

public class CreateMessageTemplateInput : SaveMessageTemplateInput
{
    /// <summary>Fixed for the template's life.</summary>
    [Required]
    public MessageChannelType Channel { get; set; }
}

public class PreviewMessageTemplateInput
{
    [Required]
    public MessageChannelType Channel { get; set; }

    [StringLength(MessageTemplateConsts.MaxContentLength)]
    public string? Content { get; set; }

    [StringLength(MessageTemplateConsts.MaxSubjectLength)]
    public string? Subject { get; set; }

    public Dictionary<string, string>? ParamMap { get; set; }

    public bool RemoveDiacritics { get; set; }

    /// <summary>The customer to fill the variables from; none = the library's example values.</summary>
    public Guid? PatientId { get; set; }
}

public class MessagePreviewDto
{
    public string Text { get; set; } = string.Empty;
    public string? Subject { get; set; }

    /// <summary>Zalo: each ZNS parameter with its filled value.</summary>
    public List<MessagePreviewParamDto> Params { get; set; } = [];

    /// <summary>Variables this customer has no value for and no fallback: a send leaves them out.</summary>
    public List<string> Missing { get; set; } = [];

    /// <summary>Names in braces that are not in the variable library.</summary>
    public List<string> Unknown { get; set; } = [];

    public SmsMeasureDto? Measure { get; set; }

    /// <summary>true when the example values were used rather than a customer's.</summary>
    public bool IsSample { get; set; }
}

public class MessagePreviewParamDto
{
    public string Name { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}

/// <summary>A customer of the branch for the editor's preview; all null when the branch has none.</summary>
public class MessageSampleCustomerDto
{
    public Guid? PatientId { get; set; }
    public string? Name { get; set; }
    public string? Code { get; set; }
}

/// <summary>A row of "Thư viện biến". The label is the interface text <c>CSKH:Var:{Key}</c>.</summary>
public class MessageVariableDto
{
    public string Key { get; set; } = string.Empty;
    public MessageVariableGroup Group { get; set; }
    public string Example { get; set; } = string.Empty;
    public MessageVariableWhenEmpty WhenEmpty { get; set; }
    public string? Fallback { get; set; }

    /// <summary>Shown under "Biến hay dùng".</summary>
    public bool IsCommon { get; set; }
}

public class SyncZaloTemplateStatusDto
{
    /// <summary>false when the branch has no Zalo OA linked; nothing was read.</summary>
    public bool Connected { get; set; }

    /// <summary>Templates whose status changed.</summary>
    public int Updated { get; set; }

    /// <summary>Zalo's refusal, when the read failed.</summary>
    public string? Error { get; set; }
}
