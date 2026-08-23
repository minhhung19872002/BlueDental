using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

public class MedicationTypeDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateMedicationTypeDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class UpdateMedicationTypeDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class GetMedicationTypeListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

public interface IMedicationTypeAppService : IApplicationService
{
    Task<PagedResultDto<MedicationTypeDto>> GetListAsync(GetMedicationTypeListInput input);
    Task<MedicationTypeDto> GetAsync(Guid id);
    Task<MedicationTypeDto> CreateAsync(CreateMedicationTypeDto input);
    Task<MedicationTypeDto> UpdateAsync(Guid id, UpdateMedicationTypeDto input);
    Task DeleteAsync(Guid id);
}
