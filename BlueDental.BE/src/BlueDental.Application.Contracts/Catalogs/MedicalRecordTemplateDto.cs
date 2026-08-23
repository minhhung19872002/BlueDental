using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

public class MedicalRecordTemplateDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Content { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateMedicalRecordTemplateDto
{
    public string Name { get; set; } = default!;
    public string? Content { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class UpdateMedicalRecordTemplateDto
{
    public string Name { get; set; } = default!;
    public string? Content { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class GetMedicalRecordTemplateListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

public interface IMedicalRecordTemplateAppService : IApplicationService
{
    Task<PagedResultDto<MedicalRecordTemplateDto>> GetListAsync(GetMedicalRecordTemplateListInput input);
    Task<MedicalRecordTemplateDto> GetAsync(Guid id);
    Task<MedicalRecordTemplateDto> CreateAsync(CreateMedicalRecordTemplateDto input);
    Task<MedicalRecordTemplateDto> UpdateAsync(Guid id, UpdateMedicalRecordTemplateDto input);
    Task DeleteAsync(Guid id);
}
