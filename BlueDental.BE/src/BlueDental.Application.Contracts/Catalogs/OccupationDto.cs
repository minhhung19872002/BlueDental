using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

public class OccupationDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateOccupationDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class UpdateOccupationDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class GetOccupationListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

public interface IOccupationAppService : IApplicationService
{
    Task<PagedResultDto<OccupationDto>> GetListAsync(GetOccupationListInput input);
    Task<OccupationDto> GetAsync(Guid id);
    Task<OccupationDto> CreateAsync(CreateOccupationDto input);
    Task<OccupationDto> UpdateAsync(Guid id, UpdateOccupationDto input);
    Task DeleteAsync(Guid id);
}
