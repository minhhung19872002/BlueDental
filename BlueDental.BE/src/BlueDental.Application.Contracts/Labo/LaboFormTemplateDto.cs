using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Labo;

/// <summary>One field of a Mẫu phiếu bổ sung (F-93), as read and as written.</summary>
public class LaboFormFieldDto
{
    /// <summary>Stable across edits. A new field sends none and is given one.</summary>
    [MaxLength(40)]
    public string? Key { get; set; }

    [MaxLength(200)]
    public string? Label { get; set; }

    public LaboFormFieldType Type { get; set; } = LaboFormFieldType.Text;
    public bool Required { get; set; }

    /// <summary>The choices of a Select / MultiSelect field; ignored for the other kinds.</summary>
    public List<string> Options { get; set; } = [];
}

public class LaboFormTemplateDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public int Version { get; set; }
    public List<LaboFormFieldDto> Fields { get; set; } = [];
}

public class SaveLaboFormTemplateDto
{
    [MaxLength(200)]
    public string? Name { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public Guid? ClinicBranchId { get; set; }

    /// <summary>Trạng thái: omitted keeps what is stored; a new template starts Đang dùng.</summary>
    public bool? IsActive { get; set; }

    public List<LaboFormFieldDto> Fields { get; set; } = [];
}

public class SetLaboFormTemplateActiveDto
{
    public bool IsActive { get; set; }
}

public class GetLaboFormTemplateListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public string? Filter { get; set; }

    /// <summary>The Phiếu yêu cầu asks for the Đang dùng ones only.</summary>
    public bool? IsActive { get; set; }
}

public interface ILaboFormTemplateAppService : IApplicationService
{
    Task<PagedResultDto<LaboFormTemplateDto>> GetListAsync(GetLaboFormTemplateListInput input);
    Task<LaboFormTemplateDto> GetAsync(Guid id);
    Task<LaboFormTemplateDto> CreateAsync(SaveLaboFormTemplateDto input);
    Task<LaboFormTemplateDto> UpdateAsync(Guid id, SaveLaboFormTemplateDto input);
    Task<LaboFormTemplateDto> SetActiveAsync(Guid id, SetLaboFormTemplateActiveDto input);
    Task DeleteAsync(Guid id);
}
