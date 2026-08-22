using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

public class MedicalHistoryTypeDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateMedicalHistoryTypeDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class UpdateMedicalHistoryTypeDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class GetMedicalHistoryTypeListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

public interface IMedicalHistoryTypeAppService : IApplicationService
{
    Task<PagedResultDto<MedicalHistoryTypeDto>> GetListAsync(GetMedicalHistoryTypeListInput input);
    Task<MedicalHistoryTypeDto> GetAsync(Guid id);
    Task<MedicalHistoryTypeDto> CreateAsync(CreateMedicalHistoryTypeDto input);
    Task<MedicalHistoryTypeDto> UpdateAsync(Guid id, UpdateMedicalHistoryTypeDto input);
    Task DeleteAsync(Guid id);
}
