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

    /// <summary>The custom section it sits in (F-94); none, or one not in the layout, puts it in the first.</summary>
    [MaxLength(40)]
    public string? BlockKey { get; set; }
}

/// <summary>One block of a Mẫu phiếu's layout (F-94), as read and as written.</summary>
public class LaboFormBlockDto
{
    /// <summary>A system block's is its kind; a custom section's is stable across edits (the builder makes one up).</summary>
    [MaxLength(40)]
    public string? Key { get; set; }

    public LaboFormBlockKind Kind { get; set; }

    /// <summary>The heading; none keeps a system block's own name. Required on a custom section.</summary>
    [MaxLength(200)]
    public string? Title { get; set; }

    /// <summary>Thông tin phiếu and Chỉ định are always shown.</summary>
    public bool Visible { get; set; } = true;

    /// <summary>Width on the slip's three-column grid, 1–3.</summary>
    public int Span { get; set; } = 3;
}

public class LaboFormTemplateDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public int Version { get; set; }
    public List<LaboFormFieldDto> Fields { get; set; } = [];

    /// <summary>The slip's layout in order (F-94); a template saved before layouts reads as the default one.</summary>
    public List<LaboFormBlockDto> Blocks { get; set; } = [];
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

    /// <summary>
    /// The layout (F-94): every system block once, in the order wanted, with
    /// the custom sections. None sent keeps the F-93 shape — the default layout
    /// with the fields in one "Thông tin bổ sung" section.
    /// </summary>
    public List<LaboFormBlockDto>? Blocks { get; set; }
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
