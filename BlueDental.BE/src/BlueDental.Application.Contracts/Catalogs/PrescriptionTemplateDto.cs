using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

public class PrescriptionTemplateDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Content { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreatePrescriptionTemplateDto
{
    public string Name { get; set; } = default!;
    public string? Content { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class UpdatePrescriptionTemplateDto
{
    public string Name { get; set; } = default!;
    public string? Content { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class GetPrescriptionTemplateListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

public interface IPrescriptionTemplateAppService : IApplicationService
{
    Task<PagedResultDto<PrescriptionTemplateDto>> GetListAsync(GetPrescriptionTemplateListInput input);
    Task<PrescriptionTemplateDto> GetAsync(Guid id);
    Task<PrescriptionTemplateDto> CreateAsync(CreatePrescriptionTemplateDto input);
    Task<PrescriptionTemplateDto> UpdateAsync(Guid id, UpdatePrescriptionTemplateDto input);
    Task DeleteAsync(Guid id);
}
