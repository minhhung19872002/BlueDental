using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Notifications;

/// <summary>
/// The two lists behind the CSKH "Lưu tin nhắn" dialog — reference:
/// <c>GET /sender-sms-templates</c> (Mẫu tin nhắn) and
/// <c>GET /clinic-configure?module=sms&amp;isEnabled=true</c> (Cấu hình).
/// </summary>
public interface IMessagingAppService : IApplicationService
{
    Task<PagedResultDto<SmsTemplateDto>> GetSmsTemplatesAsync(GetSmsTemplatesInput input);
    Task<PagedResultDto<ClinicConfigureDto>> GetClinicConfiguresAsync(GetClinicConfiguresInput input);
}

public class SmsTemplateDto : EntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string Content { get; set; } = default!;
}

public class ClinicConfigureDto : EntityDto<Guid>
{
    public string Module { get; set; } = default!;
    public string Name { get; set; } = default!;
    public bool IsEnabled { get; set; }
}

/// <summary>Reference sends <c>perPage/page/search</c>; local keeps ABP paging.</summary>
public class GetSmsTemplatesInput : PagedResultRequestDto
{
    /// <summary>Tìm kiếm theo tên mẫu (reference <c>search</c>).</summary>
    public string? Filter { get; set; }
}

public class GetClinicConfiguresInput : PagedResultRequestDto
{
    /// <summary>Reference <c>module</c>, e.g. "sms".</summary>
    public string? Module { get; set; }

    /// <summary>Reference <c>isEnabled</c>; null returns both.</summary>
    public bool? IsEnabled { get; set; }

    /// <summary>Tìm kiếm theo tên cấu hình (reference <c>search</c>).</summary>
    public string? Filter { get; set; }
}
