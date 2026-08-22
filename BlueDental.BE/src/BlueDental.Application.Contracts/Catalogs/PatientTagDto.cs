using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

public class PatientTagDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Color { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class CreatePatientTagDto
{
    public string Name { get; set; } = default!;
    public string? Color { get; set; }
    public string? Description { get; set; }
}

public class UpdatePatientTagDto
{
    public string Name { get; set; } = default!;
    public string? Color { get; set; }
    public string? Description { get; set; }
}

public class GetPatientTagListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

public interface IPatientTagAppService : IApplicationService
{
    Task<PagedResultDto<PatientTagDto>> GetListAsync(GetPatientTagListInput input);
    Task<PatientTagDto> GetAsync(Guid id);
    Task<PatientTagDto> CreateAsync(CreatePatientTagDto input);
    Task<PatientTagDto> UpdateAsync(Guid id, UpdatePatientTagDto input);
    Task DeleteAsync(Guid id);
}
