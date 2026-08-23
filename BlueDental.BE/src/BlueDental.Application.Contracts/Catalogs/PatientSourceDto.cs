using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

public class PatientSourceDto : FullAuditedEntityDto<Guid>
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreatePatientSourceDto
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class UpdatePatientSourceDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class GetPatientSourceListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

public interface IPatientSourceAppService : IApplicationService
{
    Task<PagedResultDto<PatientSourceDto>> GetListAsync(GetPatientSourceListInput input);
    Task<PatientSourceDto> GetAsync(Guid id);
    Task<PatientSourceDto> CreateAsync(CreatePatientSourceDto input);
    Task<PatientSourceDto> UpdateAsync(Guid id, UpdatePatientSourceDto input);
    Task DeleteAsync(Guid id);
}
